import {beforeEach,describe,it,expect,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import Assistant from './Assistant';
const mocks=vi.hoisted(()=>({
 invoke:vi.fn(),from:vi.fn(),error:vi.fn(),
 auth:{user:{id:'user-A'},activeOrg:{organization_id:'org-A',organization:{name:'Company A'}}},
}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>mocks.auth}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{functions:{invoke:mocks.invoke},from:mocks.from}}));
vi.mock('@/lib/paddle',()=>({getPaddleEnvironment:()=> 'live'}));
vi.mock('@/hooks/useVoice',()=>({
 useVoiceRecorder:()=>({recording:false,transcribing:false,start:vi.fn(),stop:vi.fn()}),
 useVoiceSpeaker:()=>({speak:vi.fn(),stop:vi.fn(),speakingId:null,loadingId:null}),
}));
vi.mock('@/lib/generateDocumentPdf',()=>({generateDocumentPdf:vi.fn()}));
vi.mock('sonner',()=>({toast:{error:mocks.error,success:vi.fn()}}));
beforeEach(()=>{
 cleanup();vi.clearAllMocks();
 mocks.auth.activeOrg={organization_id:'org-A',organization:{name:'Company A'}};
 Element.prototype.scrollTo=vi.fn();
 mocks.invoke.mockResolvedValue({data:{content:'Company A answer',tool_calls:[]},error:null});
});
const send=()=>{
 fireEvent.change(screen.getByRole('textbox',{name:'Ask AI'}),{target:{value:'Draft an estimate for John'}});
 fireEvent.click(screen.getByRole('button',{name:'Send to Ask AI'}));
};
describe('Ask AI company isolation',()=>{
 it('sends business requests to its independent AI endpoint',async()=>{
  render(<Assistant/>);send();
  await screen.findByText('Company A answer');
  expect(mocks.invoke).toHaveBeenCalledWith('ai-assistant',expect.objectContaining({body:expect.objectContaining({organizationId:'org-A',environment:'live'})}));
  expect(mocks.from).not.toHaveBeenCalled();
 });
 it('clears conversation and pending proposals when the active company changes',async()=>{
  mocks.invoke.mockResolvedValue({data:{content:'Company A draft',tool_calls:[{id:'p1',name:'create_lead',args:{name:'A lead'},needsApproval:true}]},error:null});
  const view=render(<Assistant/>);send();
  await screen.findByRole('button',{name:'Approve & apply'});
  mocks.auth.activeOrg={organization_id:'org-B',organization:{name:'Company B'}};
  view.rerender(<Assistant/>);
  expect(screen.queryByText('Company A draft')).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Approve & apply'})).not.toBeInTheDocument();
  expect(screen.getByRole('textbox',{name:'Ask AI'})).toHaveValue('');
  expect(mocks.from).not.toHaveBeenCalled();
 });
 it('discards an old company response that finishes after switching',async()=>{
  let resolve!:(value:unknown)=>void;
  mocks.invoke.mockImplementation(()=>new Promise(r=>{resolve=r;}));
  const view=render(<Assistant/>);send();
  await waitFor(()=>expect(mocks.invoke).toHaveBeenCalled());
  mocks.auth.activeOrg={organization_id:'org-B',organization:{name:'Company B'}};
  view.rerender(<Assistant/>);
  await act(async()=>resolve({data:{content:'Late Company A response',tool_calls:[]},error:null}));
  expect(screen.queryByText('Late Company A response')).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Send to Ask AI'})).toBeDisabled();
 });
 it.each(['click','enter'])('uses the same explicit navigation handler for %s',async(method)=>{
  const onNavigate=vi.fn(()=>true);
  render(<Assistant compact onNavigate={onNavigate}/>);
  const input=screen.getByRole('textbox',{name:'Ask AI'});
  fireEvent.change(input,{target:{value:'open estimates'}});
  if(method==='click')fireEvent.click(screen.getByRole('button',{name:'Send to Ask AI'}));
  else fireEvent.keyDown(input,{key:'Enter'});
  expect(onNavigate).toHaveBeenCalledWith('open estimates');
  expect(mocks.invoke).not.toHaveBeenCalled();
 });
});

it('shows record provenance and unavailable categories without claiming a full ledger', async()=>{
 mocks.invoke.mockResolvedValue({data:{content:'Recent records',tool_calls:[],sources:[
  {label:'Invoices',path:'/app/invoices',available:true,shown:30,total:45,truncated:true},
  {label:'Jobs',path:'/app/jobs',available:false,shown:0,total:null,truncated:false},
 ]},error:null});
 render(<Assistant/>);send();
 expect(await screen.findByRole('link',{name:'Invoices: 30 of 45'})).toHaveAttribute('href','/app/invoices');
 expect(screen.getByRole('link',{name:'Jobs: unavailable'})).toBeInTheDocument();
});
it('refuses an ambiguous customer match before scheduling a job', async()=>{
 mocks.invoke.mockResolvedValue({data:{content:'Review schedule',tool_calls:[{id:'p1',name:'schedule_job',args:{customer_name:'John',title:'Driveway'},needsApproval:true}]},error:null});
 const limit=vi.fn().mockResolvedValue({data:[{id:'a'},{id:'b'}],error:null});
 const query={select:vi.fn(),eq:vi.fn(),ilike:vi.fn(),limit};
 query.select.mockReturnValue(query);query.eq.mockReturnValue(query);query.ilike.mockReturnValue(query);
 mocks.from.mockReturnValue(query);
 render(<Assistant/>);send();
 fireEvent.click(await screen.findByRole('button',{name:'Approve & apply'}));
 expect(await screen.findByText(/More than one record matches/)).toBeInTheDocument();
 expect(mocks.from).toHaveBeenCalledTimes(1);
 expect(mocks.from).toHaveBeenCalledWith('customers');
});
describe('Ask AI agent mode',()=>{
 it('shows the lookups the agent ran on its own',async()=>{
  mocks.invoke.mockResolvedValue({data:{content:'Dana owes $750.',tool_calls:[],steps:[{name:'find_customers',summary:'Searched customers matching "Dana" — 1 found'},{name:'find_invoices',summary:'Searched unpaid invoices — 1 found'}]},error:null});
  render(<Assistant/>);send();
  await screen.findByText('Dana owes $750.');
  const steps=screen.getByRole('list',{name:'Agent steps'});
  expect(steps).toHaveTextContent('Searched customers matching "Dana" — 1 found');
  expect(steps).toHaveTextContent('Searched unpaid invoices — 1 found');
 });
 it('hands approval results back so the agent can take the next step',async()=>{
  mocks.invoke
   .mockResolvedValueOnce({data:{content:'First I need to add the customer.',tool_calls:[{id:'p1',name:'create_customer',args:{name:'Dana Smith'},needsApproval:true}]},error:null})
   .mockResolvedValueOnce({data:{content:'Now the job.',tool_calls:[{id:'p2',name:'schedule_job',args:{customer_name:'Dana Smith',title:'Patio'},needsApproval:true}]},error:null});
  const insert=vi.fn().mockResolvedValue({error:null});
  mocks.from.mockReturnValue({insert});
  render(<Assistant/>);send();
  fireEvent.click(await screen.findByRole('button',{name:'Approve & apply'}));
  await screen.findByText('Now the job.');
  expect(mocks.invoke).toHaveBeenCalledTimes(2);
  const sent=mocks.invoke.mock.calls[1][1].body.messages;
  const last=sent[sent.length-1];
  expect(last.role).toBe('user');
  expect(last.content).toMatch(/Approval results[\s\S]*Create customer: APPLIED — Customer "Dana Smith" created/);
  // The internal results note is not shown as a chat bubble.
  expect(screen.queryByText(/Approval results/)).not.toBeInTheDocument();
  // Exactly one continuation per batch.
  await new Promise(r=>setTimeout(r,20));
  expect(mocks.invoke).toHaveBeenCalledTimes(2);
 });
 it('does not continue when every proposal was rejected',async()=>{
  mocks.invoke.mockResolvedValueOnce({data:{content:'Proposed.',tool_calls:[{id:'p1',name:'create_lead',args:{name:'X'}, needsApproval:true}]},error:null});
  mocks.from.mockReturnValue({insert:vi.fn().mockResolvedValue({error:null})});
  render(<Assistant/>);send();
  fireEvent.click(await screen.findByRole('button',{name:'Reject'}));
  await screen.findByText('Rejected');
  await new Promise(r=>setTimeout(r,20));
  expect(mocks.invoke).toHaveBeenCalledTimes(1);
 });
});
