import { ArrowUpRight, CalendarClock, CheckCircle2, CircleAlert, History, Layers3, ListChecks, Trash2 } from "lucide-react";
import type { HistoryRecord } from "../../types/analysis";

interface HistoryPageProps {
  records: HistoryRecord[];
  onOpen: (record: HistoryRecord) => void;
  onRequestClear: () => void;
}

export function HistoryPage({ records, onOpen, onRequestClear }: HistoryPageProps) {
  const totals = records.reduce(
    (summary, record) => ({
      tests: summary.tests + record.stats.total,
      success: summary.success + record.stats.success,
      failures: summary.failures + record.stats.failures,
    }),
    { tests: 0, success: 0, failures: 0 },
  );
  const successRate = totals.tests ? Math.round((totals.success / totals.tests) * 100) : 0;

  return (
    <section className="page history-page">
      <div className="page-heading">
        <div><h2>Historique des analyses</h2><p>Retrouvez et rechargez les executions sauvegardees localement.</p></div>
        <button className="button button--danger-soft" type="button" onClick={onRequestClear} disabled={!records.length}><Trash2 size={16} /><span>Vider l'historique</span></button>
      </div>
      {records.length ? (
        <>
          <div className="history-overview" aria-label="Resume de l'historique">
            <HistoryMetric icon={<History size={18} />} label="Analyses" value={records.length.toLocaleString("fr-FR")} />
            <HistoryMetric icon={<ListChecks size={18} />} label="Tests analyses" value={totals.tests.toLocaleString("fr-FR")} />
            <HistoryMetric icon={<CheckCircle2 size={18} />} label="Taux de succes" value={`${successRate}%`} tone="pass" />
            <HistoryMetric icon={<CalendarClock size={18} />} label="Derniere analyse" value={records[0].createdAt} wide />
          </div>

          <div className="history-table-wrap">
            <table className="data-table history-table">
              <colgroup><col className="history-col-date" /><col className="history-col-scope" /><col className="history-col-results" /><col className="history-col-quality" /><col className="history-col-action" /></colgroup>
              <thead><tr><th>Analyse</th><th>Perimetre</th><th>Resultats</th><th>Qualite</th><th><span className="sr-only">Action</span></th></tr></thead>
              <tbody>{records.map((record, index) => (
                <HistoryTableRow key={record.id} record={record} latest={index === 0} onOpen={onOpen} />
              ))}</tbody>
            </table>
          </div>

          <div className="history-mobile-list">
            {records.map((record, index) => <HistoryMobileRow key={record.id} record={record} latest={index === 0} onOpen={onOpen} />)}
          </div>
        </>
      ) : (
        <div className="empty-state"><span className="empty-state__icon"><History size={29} /></span><h3>Historique vide</h3><p>Chaque analyse terminee sera ajoutee ici automatiquement.</p></div>
      )}
    </section>
  );
}

function HistoryMetric({ icon, label, value, tone = "default", wide = false }: { icon: React.ReactNode; label: string; value: string; tone?: "default" | "pass"; wide?: boolean }) {
  return (
    <div className={`history-metric history-metric--${tone} ${wide ? "history-metric--wide" : ""}`}>
      <i>{icon}</i>
      <span><small>{label}</small><strong title={value}>{value}</strong></span>
    </div>
  );
}

function HistoryTableRow({ record, latest, onOpen }: { record: HistoryRecord; latest: boolean; onOpen: (record: HistoryRecord) => void }) {
  const rate = getSuccessRate(record);
  return (
    <tr
      className="history-row"
      tabIndex={0}
      onClick={() => onOpen(record)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onOpen(record);
      }}
    >
      <td>
        <div className="history-date"><CalendarClock size={17} /><span><strong>{record.createdAt}</strong>{latest ? <small>Derniere analyse</small> : <small>Analyse locale</small>}</span></div>
      </td>
      <td><div className="history-scope"><strong>{record.stats.total} tests</strong><small><Layers3 size={13} />{record.stats.modules} modules</small></div></td>
      <td><HistoryOutcome record={record} /></td>
      <td><HistoryQuality rate={rate} success={record.stats.success} total={record.stats.total} /></td>
      <td className="history-action-cell">
        <button className="icon-button history-open" type="button" onClick={(event) => { event.stopPropagation(); onOpen(record); }} aria-label={`Ouvrir l'analyse du ${record.createdAt}`} title="Ouvrir l'analyse"><ArrowUpRight size={18} /></button>
      </td>
    </tr>
  );
}

function HistoryMobileRow({ record, latest, onOpen }: { record: HistoryRecord; latest: boolean; onOpen: (record: HistoryRecord) => void }) {
  const rate = getSuccessRate(record);
  return (
    <article className="history-mobile-row" onClick={() => onOpen(record)}>
      <header>
        <div><CalendarClock size={16} /><span><strong>{record.createdAt}</strong><small>{latest ? "Derniere analyse" : "Analyse locale"}</small></span></div>
        <button className="icon-button history-open" type="button" onClick={(event) => { event.stopPropagation(); onOpen(record); }} aria-label={`Ouvrir l'analyse du ${record.createdAt}`}><ArrowUpRight size={18} /></button>
      </header>
      <div className="history-mobile-row__scope"><span><ListChecks size={14} />{record.stats.total} tests</span><span><Layers3 size={14} />{record.stats.modules} modules</span></div>
      <HistoryOutcome record={record} />
      <HistoryQuality rate={rate} success={record.stats.success} total={record.stats.total} />
    </article>
  );
}

function HistoryOutcome({ record }: { record: HistoryRecord }) {
  return (
    <div className="history-outcome">
      <span className="history-outcome--pass"><CheckCircle2 size={15} /><strong>{record.stats.success}</strong><small>succes</small></span>
      <span className="history-outcome--fail"><CircleAlert size={15} /><strong>{record.stats.failures}</strong><small>echecs</small></span>
    </div>
  );
}

function HistoryQuality({ rate, success, total }: { rate: number; success: number; total: number }) {
  return (
    <div className="history-quality">
      <span><strong>{rate}%</strong><small>{success}/{total}</small></span>
      <div className="history-quality__track"><i style={{ width: `${rate}%` }} /></div>
    </div>
  );
}

function getSuccessRate(record: HistoryRecord): number {
  return record.stats.total ? Math.round((record.stats.success / record.stats.total) * 100) : 0;
}
