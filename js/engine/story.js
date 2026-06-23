// Story engine: drives Acts → beats, tutorial gates, Lead-only decisions, and the
// end-of-prologue screen. Beat schema is documented in docs/DATA-SCHEMA.md.

import { State } from '../state.js';
import { el, mount, paragraphs } from '../util/dom.js';
import { Media } from './media.js';
import { Board } from './board.js';
import { TwoP } from './twoplayer.js';
import { diff } from './difficulty.js';
import { Accusation } from '../screens/accusation.js';

function curAct() { return State.caseData?.acts?.[State.progress.actIndex]; }
function curBeat() { const a = curAct(); return a && a.beats[State.progress.beatIndex]; }

function applyBeat(beat, app) {
  if (State.progress.visited.includes(beat.id)) return;
  State.progress.visited.push(beat.id);
  if (beat.unlock) for (const [b, ids] of Object.entries(beat.unlock)) State.unlock(b, ids);
  if (beat.collect) beat.collect.forEach(c => Board.collect(c, app));
  if (beat.advise) {
    beat.advise.forEach(t => TwoP.advise(t));
    if (diff().proactiveHints && beat.advise[0]) app.toast('Partner: ' + beat.advise[0]);
  }
  State.saveProgress();
}

function gate(beat) {
  const req = beat.require;
  if (!req) return { ok: true };
  if (diff().softRequire) return { ok: true };
  const P = State.progress;
  switch (req.type) {
    case 'open-tab': return { ok: P.tabsSeen.includes(req.target), hint: 'زبانه‌ی موردنظر را باز کن تا ادامه دهی.' };
    case 'examine-evidence':
      if (req.target) return { ok: P.examined.evidence.includes(req.target), hint: 'مدرک تازه را بررسی کن و برگرد.' };
      return { ok: P.examined.evidence.length >= (req.n || 1), hint: `${req.n || 1} مدرک را بررسی کن.` };
    case 'interview': return { ok: P.interviewed.includes(req.target), hint: 'در زبانه‌ی اشخاص با فرد موردنظر مصاحبه کن و برگرد.' };
    case 'search':
      if (req.target) return { ok: P.examined.hotspots.includes(req.target), hint: 'صحنه را برای یافتن سرنخ بگرد.' };
      return { ok: P.examined.hotspots.length >= (req.n || 1), hint: 'در یک مکان جست‌وجو کن.' };
    case 'collect-clue': return { ok: Board.collected().includes(req.target), hint: 'سرنخ مربوطه را به تابلو اضافه کن.' };
    case 'conclusion': return { ok: Board.hasConclusion(req.target), hint: 'در تابلوی استنتاج، سرنخ‌ها را به هم وصل کن تا استنتاج لازم شکل بگیرد.' };
    default: return { ok: true };
  }
}

function advance(app, goto) {
  const P = State.progress, act = curAct();
  if (goto) {
    const idx = act.beats.findIndex(b => b.id === goto);
    if (idx >= 0) { P.beatIndex = idx; State.saveProgress(); app.showStory(); return; }
  }
  P.beatIndex++;
  if (P.beatIndex >= act.beats.length) {
    if (P.actIndex < State.caseData.acts.length - 1) { P.actIndex++; P.beatIndex = 0; }
    else { P.phase = 'prologue-end'; }
  }
  State.saveProgress();
  app.showStory();
}

export const Story = {
  render(app, container) {
    if (State.progress.phase === 'prologue-end') return this.renderEnd(app, container);
    const beat = curBeat();
    if (!beat) { mount(container, el('div', { class: 'empty', text: 'داستان به پایان رسید.' })); return; }
    applyBeat(beat, app);

    // special beat types
    if (beat.type === 'accusation') {
      return Accusation.render(app, container, beat, (verdict) => { State.flag('verdict', verdict); State.saveProgress(); advance(app, beat.goto); });
    }
    if (beat.type === 'ending') { return Accusation.renderEnding(app, container, beat); }

    const node = el('div', { class: 'beat' });
    if (beat.act_label) node.append(el('div', { class: 'kicker mb', text: beat.act_label }));
    if (beat.image) node.append(Media.img(beat.image, { alt: beat.title || '', glyph: '🎬', cls: 'beat-img' }), el('div', { style: { height: '1rem' } }));
    if (beat.title) node.append(el('h2', { text: beat.title, style: { marginTop: 0 } }));

    if (beat.speaker) {
      const p = State.caseData.people[beat.speaker];
      if (p) node.append(el('div', { class: 'speaker mb' }, Media.portrait(p.id, { size: 44 }),
        el('div', {}, el('div', { class: 'who', text: p.name }), el('div', { class: 'bubble', html: Array.isArray(beat.body) ? beat.body.join(' ') : beat.body }))));
    } else if (beat.body) {
      node.append(el('div', { class: 'beat-body' }, ...paragraphs(beat.body, 'lead')));
    }

    if (beat.callout) node.append(el('div', { class: 'callout' }, el('span', { class: 'label', text: 'راهنما' }), el('div', { html: beat.callout })));

    // choices (decision) or continue
    if (beat.choices) {
      if (beat.lead_only && !TwoP.canCommit()) {
        node.append(TwoP.passToLeadPrompt(app));
      } else {
        if (beat.lead_only) node.append(el('div', { class: 'label mb', text: '★ تصمیم با کارآگاه ارشد' }));
        const opts = el('div', { class: 'dlg-options mt' });
        for (const ch of beat.choices) {
          opts.append(el('button', { class: 'opt', dataset: { choice: ch.id }, onclick: () => {
            State.progress.decisions[beat.id] = ch.id;
            if (ch.setFlag) State.flag(ch.setFlag, ch.flagValue === undefined ? true : ch.flagValue);
            if (ch.unlock) for (const [b, ids] of Object.entries(ch.unlock)) State.unlock(b, ids);
            if (ch.advise) ch.advise.forEach(t => TwoP.advise(t));
            State.saveProgress();
            advance(app, ch.goto);
          } }, el('h4', { text: ch.label }), ch.detail ? el('p', { text: ch.detail }) : null));
        }
        node.append(opts);
      }
    } else {
      const g = gate(beat);
      const btn = el('button', { class: 'btn btn-primary mt', text: beat.continueLabel || 'ادامه ◂', disabled: !g.ok, onclick: () => advance(app, beat.goto) });
      node.append(btn);
      if (!g.ok) node.append(el('div', { class: 'gate-hint mt', text: g.hint }));
    }

    mount(container, node);
  },

  renderEnd(app, container) {
    const node = el('div', { class: 'beat tcenter' },
      el('div', { class: 'kicker', text: 'پایان پرده ۱ — پیش‌درآمد' }),
      el('h2', { text: 'اتاقی که دیگر وجود ندارد' }),
      el('div', { class: 'beat-body', style: { textAlign: 'start' } },
        ...paragraphs(
          'آزمایش سم‌شناسی پاک از کار درمی‌آید. پزشک قانونی کالبدشکافی کامل می‌خواهد — قرائت‌ها از یک قلبِ ایستاده هم عجیب‌ترند.\n\n' +
          'و آن صدا روی بلندگوهای استودیو، همان که عزاداران برایش اشک می‌ریزند: تو تمام دوران نقاهتت آن را شنیده‌ای، و امشب «ناجور» است. زیادی یکنواخت. نفس‌هایی مثل ضربان مترونوم. وزوزِ فضای اتاقی که هفته‌ها پیش کنده و دوباره سیم‌کشی شده.\n\n' +
          'اگر آن ضبط‌ها در اتاقی ساخته شده‌اند که دیگر وجود ندارد… پس دل‌آرا وثوقی دیشب نمرده است. پرسش هیچ‌وقت «چه کسی او را کشت» نبوده. پرسش این است: «دقیقاً کِی مرد» — و از آن شب تا حالا چه کسی صدایش را به تن کرده است.',
          'lead')),
      el('div', { class: 'callout', style: { textAlign: 'start' } },
        el('span', { class: 'label', text: 'این پیش‌درآمد، فصل نخست است' }),
        el('div', { html: 'هر ابزاری که لازم داری را یاد گرفتی: <b>مدارک</b>، <b>اشخاص</b>، <b>مکان‌ها</b>، <b>تابلوی استنتاج</b>، نمایشگر <b>تحلیل صوتی</b>، و تقسیم نقش <b>ارشد/همکار</b>. پرده‌های ۲ تا ۴ — انباری، حقیقتِ منجمد، ضبطِ تاک‌بک و اتهام نهایی — در دست ساخت‌اند.' })),
      el('div', { class: 'row mt2', style: { justifyContent: 'center', flexWrap: 'wrap' } },
        el('button', { class: 'btn btn-primary', text: '↻ بازی دوباره‌ی پیش‌درآمد', onclick: () => { State.resetProgress(); State.progress = State.freshProgress(); State.saveProgress(); app.go('play'); } }),
        el('button', { class: 'btn', text: 'تنظیمات بازی', onclick: () => app.go('onboarding') }),
        el('button', { class: 'btn', text: 'پرونده‌های دیگر', onclick: () => app.go('menu') }),
        el('button', { class: 'btn btn-ghost', text: 'منابع و دست‌اندرکاران', onclick: () => app.openCredits() })));
    mount(container, node);
  },
};
