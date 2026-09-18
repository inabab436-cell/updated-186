# Roadmap

- [x] Copy GitHub project files + install deps
- [x] Fix preview/build errors
- [x] Redesign the mobile dashboard shortcuts and add concise orders, active customers, and net pending earnings summaries
- [ ] Fix "الاسم لم يطابق أي منتج في الكتالوج" leak: fuzzy/token-based product matching in src/lib/order-availability.ts
- [ ] Fuzzy color/size matching (stop exact-equality "غير متاح" false negatives)
- [ ] pickProduct in order-catalog-match.ts must resolve ambiguity instead of returning null (silent no stock deduction)
- [ ] Remove regex/keyword dependence in payment-confirmation detection -> LLM-driven intent
- [x] Reorganize dashboard sections, collapsible routed notifications, agent controls, earnings, and quick stock additions
- [x] Redesign the public waitlist page with a calm, smart, orderly visual direction and CUPAI naming
- [x] Align the waitlist page with the main CUPAI design and add a live three-day launch countdown
