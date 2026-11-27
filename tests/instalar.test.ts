import { describe, expect, it } from 'vitest';
import { whatIfNoPrompt } from '../src/ui/install';

describe('the local download button without an install prompt', () => {
  it('teaches the iPhone route, because Safari has no beforeinstallprompt', () => {
    expect(whatIfNoPrompt('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari')).toContain('Agregar a pantalla de inicio');
  });

  it('says the truth elsewhere: without HTTPS the browser prompt never fired', () => {
    expect(whatIfNoPrompt('Mozilla/5.0 (Linux; Android 14) Chrome/120')).toContain('HTTPS');
    expect(whatIfNoPrompt('Mozilla/5.0 (Windows NT 10.0) Chrome/120')).toContain('HTTPS');
  });
});
