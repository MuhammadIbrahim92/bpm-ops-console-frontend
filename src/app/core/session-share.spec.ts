import { borrowSession, shareSession } from './session-share';

describe('session sharing between tabs', () => {
  it('gives a tab without a sign-in the token of a tab that has one', async () => {
    const stop = shareSession(() => 'the-token');
    expect(await borrowSession(1000)).toBe('the-token');
    stop();
  });

  it('gets nothing when no open tab is signed in', async () => {
    const stop = shareSession(() => null);
    expect(await borrowSession(150)).toBeNull();
    stop();
  });

  it('gets nothing when no other tab is open', async () => {
    expect(await borrowSession(150)).toBeNull();
  });

  it('stops answering once the tab is closed', async () => {
    shareSession(() => 'the-token')();
    expect(await borrowSession(150)).toBeNull();
  });
});
