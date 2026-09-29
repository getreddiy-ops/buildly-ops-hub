import {it,expect,vi} from 'vitest';
import {act,renderHook} from '@testing-library/react';
import {useVoiceSpeaker} from './useVoice';
const mocks=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{functions:{invoke:mocks.invoke}}}));
vi.mock('sonner',()=>({toast:{error:vi.fn()}}));
it('does not play a delayed voice response after the session closes',async()=>{
 let resolve!:(v:unknown)=>void;
 mocks.invoke.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 const audio=vi.fn();vi.stubGlobal('Audio',audio);
 const {result,unmount}=renderHook(()=>useVoiceSpeaker());
 let pending!:Promise<void>;
 act(()=>{pending=result.current.speak('one','Company A answer');});
 unmount();
 await act(async()=>{resolve({data:{audio:'test'},error:null});await pending;});
 expect(audio).not.toHaveBeenCalled();
 vi.unstubAllGlobals();
});
