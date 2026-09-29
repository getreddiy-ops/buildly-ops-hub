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
