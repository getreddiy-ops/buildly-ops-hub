import {describe,it,expect} from 'vitest';
import {tryParseNavigation} from './FloatingAssistant';
describe('Ask AI navigation intent',()=>{
 it.each(['Draft an estimate for John','Summarize today’s jobs','Create a customer named Smith','Show me estimates over $5000','What jobs need attention?','Update the customer phone number'])('keeps a business request in AI: %s',prompt=>{
  expect(tryParseNavigation(prompt)).toBeNull();
 });
 it.each(['open estimates','go to my estimates','estimates','show me the estimates'])('navigates an exact request: %s',prompt=>{
  expect(tryParseNavigation(prompt)?.path).toBe('/app/estimates');
 });
});
