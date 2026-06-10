export const Fragment = Symbol.for('react.fragment')
export function jsx(type, props) { return { type, props } }
export function jsxs(type, props) { return { type, props } }
export function useState(initial) { return [initial, () => {}] }
export function useEffect() {}
export function useLayoutEffect() {}
export function useCallback(fn) { return fn }
export function useRef(initial) { return { current: initial } }

export default {
  Fragment,
  jsx,
  jsxs,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
}
