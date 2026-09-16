let _armed = false;

export function armAdminWelcomeToast() {
  _armed = true;
}

export function consumeAdminWelcomeToast(): boolean {
  const v = _armed;
  _armed = false;
  return v;
}
