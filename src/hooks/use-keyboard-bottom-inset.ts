import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform, type KeyboardEvent } from 'react-native';

/**
 * Returns how many pixels the on-screen keyboard currently overlaps the window.
 *
 * Prefer this over raw `endCoordinates.height`: when Android already resized the
 * window (`softwareKeyboardLayoutMode: "resize"`), overlap is ~0 and we avoid
 * double-shifting inputs off-screen.
 */
export function useKeyboardBottomInset(enabled = true) {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setInset(0);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    function onShow(event: KeyboardEvent) {
      setInset(measureKeyboardOverlap(event));
    }

    function onHide() {
      setInset(0);
    }

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [enabled]);

  return inset;
}

export function measureKeyboardOverlap(event: KeyboardEvent) {
  if (Platform.OS === 'web') return 0;

  const windowHeight = Dimensions.get('window').height;
  const keyboardTop = event.endCoordinates.screenY;

  // If the window already shrank for the keyboard, screenY ≈ window bottom → overlap 0.
  const overlap = Math.max(0, Math.ceil(windowHeight - keyboardTop));

  // Ignore tiny values (gesture bar / rounding).
  return overlap < 16 ? 0 : overlap;
}

export function dismissKeyboard() {
  Keyboard.dismiss();
}
