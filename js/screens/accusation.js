// Act 4 accusation + branching ending. The Lead answers the verdict questions; the engine
// scores them (difficulty-scaled) and routes to the matching epilogue.

import { State } from '../state.js';
import { el, mount, paragraphs } from '../util/dom.js';
import { Media } from '../engine/media.js';
import { Board } from '../engine/board.js';
import { TwoP } from '../engine/twoplayer.js';
import { diff } from '../engine/difficulty.js';

export const Accusation = {
  render(app, container, beat, onSubmit) {
    // gate: required deductions must exist first (lenient on Casual)
    const missing = (beat.requireConclusions || []).filter(c => !Board.hasConclusion(c));
    if (missing.length && !diff().softRequire) {
      mount(container, el('div', { class: 'beat' },
        el('div', { class: 'kicker', text: 'اتهام نهایی' }),
        el('h2', { text: beat.title || 'هنوز زود است' }),
        el('div', { class: 'callout' }, el('span', { class: 'label', text: 'پرونده‌ات کامل نیست' }),
          el('div', { text: 'پیش از طرح اتهام باید استنتاج‌های کلیدی را در تابلو کامل کنی. به تابلو برگرد و سرنخ‌ها را به هم وصل کن.' })),
        el('button', { class: 'btn btn-primary mt', text: 'رفتن به تابلو ◂', onclick: () => app.setTab('board') })));
      return;
    }

    if (beat.lead_only && !TwoP.canCommit()) {
      mount(container, el('div', { class: 'beat' }, el('h2', { text: beat.title || 'اتهام نهایی' }), TwoP.passToLeadPrompt(app)));
      return;
    }

    const sel = {};
    const node = el('div', { class: 'beat' });
    node.append(el('div', { class: 'kicker', text: 'اتهام نهایی' }), el('h2', { text: beat.title || 'اتهام نهایی', style: { marginTop: 0 } }));
    if (beat.intro) node.append(el('div', { class: 'beat-body mb' }, ...paragraphs(beat.intro, 'lead')));

    for (const q of beat.questions) {
      const box = el('div', { class: 'acc-q', dataset: { q: q.id } });
      box.append(el('h4', { text: q.q }));
      for (const o of q.options) {
        const isSuspect = q.type === 'suspect';
        const person = isSuspect ? State.caseData.people[o.id] : null;
        const label = isSuspect ? (person ? person.name : o.id) : o.label;
        const btn = el('button', { class: 'acc-opt', dataset: { opt: o.id }, onclick: () => {
          sel[q.id] = o.id;
          box.querySelectorAll('.acc-opt').forEach(b => b.classList.toggle('sel', b.dataset.opt === o.id));
        } });
        if (isSuspect && person) btn.append(el('div', { class: 'acc-suspect' }, Media.portrait(o.id, { size: 38 }), el('span', { text: label })));
        else btn.textContent = label;
        box.append(btn);
      }
      node.append(box);
    }

    const submit = el('button', { class: 'btn btn-primary mt', text: 'ثبتِ اتهام ◂', onclick: () => {
      if (Object.keys(sel).length < beat.questions.length) { app.toast('به همه‌ی پرسش‌ها پاسخ بده.'); return; }
      onSubmit(score(beat, sel));
    } });
    node.append(beat.lead_only ? el('div', { class: 'label mb mt', text: '★ تصمیم نهایی با کارآگاه ارشد' }) : null, submit);
    mount(container, node);
  },

  renderEnding(app, container, beat) {
    const verdict = State.flag('verdict') || 'partial';
    const body = (beat.variants && (beat.variants[verdict] || beat.variants.partial)) || '';
    const extra = beat.talkbackVariants ? (beat.talkbackVariants[State.flag('talkback') ? 'enter' : 'seal'] || '') : '';
    const titleMap = { true: 'صدا، آرام گرفت', partial: 'عدالتِ ناتمام', wrong: 'سکوت ادامه یافت' };
    const node = el('div', { class: 'beat tcenter' },
      el('div', { class: 'kicker', text: 'پایان · آخرین برداشت تمیز' }),
      el('h2', { text: beat.title || titleMap[verdict] || 'پایان' }),
      el('div', { class: 'beat-body', style: { textAlign: 'start' } }, ...paragraphs(body, 'lead'), ...(extra ? paragraphs(extra) : [])),
      el('div', { class: 'callout', style: { textAlign: 'start' } },
        el('span', { class: 'label', text: 'پرونده بسته شد' }),
        el('div', { text: verdict === 'true' ? 'حقیقت را کامل و درست نام بردی.' : verdict === 'partial' ? 'بخشی از حقیقت روشن شد، اما نه همه‌اش.' : 'اتهامِ نادرست، حقیقت را دفن کرد. شاید بار دیگر…' })),
      el('div', { class: 'row mt2', style: { justifyContent: 'center', flexWrap: 'wrap' } },
        el('button', { class: 'btn btn-primary', text: '↻ بازی دوباره', onclick: () => { State.resetProgress(); State.progress = State.freshProgress(); State.saveProgress(); app.go('play'); } }),
        el('button', { class: 'btn', text: 'منوی اصلی', onclick: () => app.go('menu') }),
        el('button', { class: 'btn btn-ghost', text: 'منابع و دست‌اندرکاران', onclick: () => app.openCredits() })));
    mount(container, node);
  },
};

function score(beat, sel) {
  const correct = {};
  beat.questions.forEach(q => { const c = q.options.find(o => o.correct); correct[q.id] = c && c.id; });
  let n = 0; for (const q of beat.questions) if (sel[q.id] === correct[q.id]) n++;
  const coreKeys = beat.coreQuestions || beat.questions.slice(0, 2).map(q => q.id);
  const coreOk = coreKeys.every(k => sel[k] === correct[k]);
  if (n === beat.questions.length) return 'true';
  if (coreOk && diff().softRequire) return 'true';     // Casual: core is enough
  if (coreOk) return 'partial';
  return 'wrong';
}
