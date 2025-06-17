export function calculateTextUpdate(
  state: string,
  text?: string,
  offset?: number,
  end?: number
): string | undefined {
  let tailPart: string;
  let headPart: string;
  if (!Number.isInteger(offset)) return;
  if (!Number.isInteger(end)) return;
  headPart = offset === 0 ? "" : state.slice(0, offset);
  tailPart = state.slice(end, state.length);
  return headPart + text + tailPart;
}
