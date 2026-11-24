/**
 * Browser-only fixes, installed from lib/polyfills.ts when Platform.OS === 'web'.
 *
 * react-native-web's Alert is a no-op, but many screens confirm destructive
 * actions with Alert.alert(title, msg, buttons) and the vault names albums
 * with Alert.prompt. Map them onto the browser's own dialogs.
 */
import { Alert, type AlertButton } from 'react-native';

type PromptCallback = ((text: string) => void) | AlertButton[] | undefined;

function line(title?: string, message?: string): string {
  return [title, message].filter(Boolean).join('\n\n');
}

function webAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  const list = buttons?.length ? buttons : [{ text: 'OK' }];
  const cancel = list.find((b) => b.style === 'cancel');
  const actions = list.filter((b) => b !== cancel);
  // Defer so the calling handler finishes first (matches native behaviour).
  setTimeout(() => {
    if (actions.length <= 1 && !cancel) {
      window.alert(line(title, message));
      actions[0]?.onPress?.();
      return;
    }
    if (actions.length === 1) {
      if (window.confirm(line(title, message) + `\n\n→ ${actions[0].text ?? 'OK'}`)) actions[0].onPress?.();
      else cancel?.onPress?.();
      return;
    }
    const menu = actions.map((b, i) => `${i + 1}. ${b.text ?? ''}`).join('\n');
    const answer = window.prompt(`${line(title, message)}\n\n${menu}`, '1');
    const idx = answer == null ? -1 : Number(answer.trim().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))) - 1;
    const chosen = actions[idx];
    if (chosen) chosen.onPress?.();
    else cancel?.onPress?.();
  }, 0);
}

function webPrompt(title: string, message?: string, callbackOrButtons?: PromptCallback, _type?: string, defaultValue?: string): void {
  setTimeout(() => {
    const text = window.prompt(line(title, message), defaultValue ?? '');
    if (text == null) {
      if (Array.isArray(callbackOrButtons)) callbackOrButtons.find((b) => b.style === 'cancel')?.onPress?.();
      return;
    }
    if (typeof callbackOrButtons === 'function') callbackOrButtons(text);
    else if (Array.isArray(callbackOrButtons)) {
      const action = callbackOrButtons.find((b) => b.style !== 'cancel');
      (action?.onPress as ((v?: string) => void) | undefined)?.(text);
    }
  }, 0);
}

let installed = false;
export function installWebPolyfills(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const A = Alert as unknown as { alert: typeof webAlert; prompt: typeof webPrompt };
  A.alert = webAlert;
  A.prompt = webPrompt;
  if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    // No browser focus rings on our text fields (they have their own styling),
    // no grey tap flash on iOS Safari, no pull-to-refresh bounce on the shell.
    style.textContent =
      'input:focus,textarea:focus{outline:none}' +
      '*{-webkit-tap-highlight-color:transparent}' +
      'html,body{overscroll-behavior:none;background:#0B0709}';
    document.head.appendChild(style);
  }
}
