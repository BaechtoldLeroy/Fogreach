// mobileJoystick.js — Floating/dynamic virtual joystick for mobile.
//
// Listens for 'demonfall:mobile-layout-ready' and hides the static rex
// joystick created by mobileControls.js. On pointerdown inside the left
// pointer region (excluding ability-button hit rects), repositions the
// joystick base under the touch and shows it. On pointerup, hides again.
//
// Analog movement + dead zone is handled in player.js:handleMobileMovement.

(function () {
  const state = {
    scene: null,
    joystick: null,
    activePointerId: null,
  };

  function _pointInRect(pt, rect) {
    if (!rect) return false;
    return pt.x >= rect.x && pt.x <= rect.x + rect.width
        && pt.y >= rect.y && pt.y <= rect.y + rect.height;
  }

  function _pointInAbilityButton(pt) {
    const rects = (typeof window.getMobileAbilityButtonHitRects === 'function')
      ? window.getMobileAbilityButtonHitRects() || []
      : [];
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      const dx = Math.abs(pt.x - r.x);
      const dy = Math.abs(pt.y - r.y);
      if (dx <= r.halfW && dy <= r.halfH) return true;
    }
    return false;
  }

  function _leftRegion() {
    return (typeof window.getMobileLeftPointerRegion === 'function')
      ? window.getMobileLeftPointerRegion()
      : null;
  }

  function _setJoystickVisible(visible) {
    const j = state.joystick;
    if (!j) return;
    if (j.base  && j.base.setVisible)  j.base.setVisible(visible);
    if (j.thumb && j.thumb.setVisible) j.thumb.setVisible(visible);
    if (typeof j.setEnable === 'function') j.setEnable(!!visible);
  }

  function _setJoystickPosition(x, y) {
    const j = state.joystick;
    if (!j) return;
    // rex exposes either .setPosition on the joystick itself or on base/thumb.
    if (typeof j.setPosition === 'function') {
      j.setPosition(x, y);
    } else {
      if (j.base  && j.base.setPosition)  j.base.setPosition(x, y);
      if (j.thumb && j.thumb.setPosition) j.thumb.setPosition(x, y);
    }
  }

  function _onPointerDown(pointer) {
    if (!state.scene || !state.joystick) return;
    if (state.activePointerId !== null) return; // already tracking a thumb
    const pt = { x: pointer.x, y: pointer.y };
    const region = _leftRegion();
    if (!_pointInRect(pt, region)) return;
    if (_pointInAbilityButton(pt)) return;

    _setJoystickPosition(pt.x, pt.y);
    _setJoystickVisible(true);
    state.activePointerId = pointer.id;
  }

  function _onPointerUp(pointer) {
    if (state.activePointerId === null) return;
    if (pointer && pointer.id !== undefined && pointer.id !== state.activePointerId) return;
    _setJoystickVisible(false);
    state.activePointerId = null;
  }

  function onLayoutReady(event) {
    const detail = event && event.detail;
    if (!detail || !detail.scene || !detail.joystick) return;
    state.scene = detail.scene;
    state.joystick = detail.joystick;

    // Hide initially — floating behavior means "invisible until touched".
    _setJoystickVisible(false);

    detail.scene.input.on('pointerdown', _onPointerDown);
    detail.scene.input.on('pointerup', _onPointerUp);
    detail.scene.input.on('pointerupoutside', _onPointerUp);

    detail.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      detail.scene.input.off('pointerdown', _onPointerDown);
      detail.scene.input.off('pointerup', _onPointerUp);
      detail.scene.input.off('pointerupoutside', _onPointerUp);
      state.scene = null;
      state.joystick = null;
      state.activePointerId = null;
    });
  }

  window.addEventListener('demonfall:mobile-layout-ready', onLayoutReady);
})();
