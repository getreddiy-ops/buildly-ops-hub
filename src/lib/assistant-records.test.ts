import { describe, it, expect, vi } from 'vitest';
import { loadAssistantRecords, type RecordsClient } from '../../supabase/functions/_shared/assistant-records';
function client(failTable?: string, count = 1) {
  const calls: {table: string; column?: string; org?: string; limit?: number}[] = [];
  return { calls, from: vi.fn((table: string) => {
    const call = {table} as typeof calls[number]; calls.push(call);
    const result = {data:[{id:'row',name:'x'.repeat(500)}],count,error:table===failTable?new Error('private failure'):null};
    const query = { eq: (column: string, org: string) => {call.column=column;call.org=org;return query;},
      order: () => query, limit: (limit:number) => {call.limit=limit;return Promise.resolve(result);} };
    return {select:()=>query};
  }) };
}
describe('assistant business snapshot', () => {
  it('scopes every native table to the authorized company and bounds record content', async () => {
    const db=client();const result=await loadAssistantRecords(db as unknown as RecordsClient,'org-A');
    expect(db.calls.map(c=>c.table)).toEqual(['customers','org_jobs','estimates','org_invoices']);
    expect(db.calls.every(c=>c.column==='organization_id' && c.org==='org-A' && c.limit===30)).toBe(true);
    expect(result.context.categories.customers.records[0].name).toHaveLength(300);
    expect(result.sources.every(s=>s.available && !s.truncated)).toBe(true);
  });
  it('marks failed reads unavailable without leaking errors or treating them as empty records', async () => {
    const result=await loadAssistantRecords(client('org_invoices') as unknown as RecordsClient,'org-B');
    expect(result.context.categories.invoices).toMatchObject({available:false,total_record_count:null});
    expect(JSON.stringify(result)).not.toContain('private failure');
    expect(result.context.categories.jobs.available).toBe(true);
  });
  it('explicitly marks incomplete snapshots', async () => {
    const result=await loadAssistantRecords(client(undefined,100) as unknown as RecordsClient,'org-A');
    expect(result.sources.every(s=>s.truncated && s.total===100)).toBe(true);
  });
  it('never queries without an organization', async () => {
    const db=client();await expect(loadAssistantRecords(db as unknown as RecordsClient,'')).rejects.toThrow();
    expect(db.from).not.toHaveBeenCalled();
  });
});
