/** Ett sted for feilsvar, så «nøklene mangler» alltid ser likt ut for klienten. */
function svarFeil(res, e) {
  if (e?.oppsettMangler) return res.status(503).json({ feil: e.message, oppsett: true });
  res.status(500).json({ feil: e?.message || 'Ukjent feil' });
}
module.exports = { svarFeil };
