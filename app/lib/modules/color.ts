const trimHash = (o: string): string => {
  return o.split('#')[1]
}
const hexToNum = (p: string[]): number => {
  return parseInt(''.concat(p[0]).concat(p[1]), 16)
}
const isReducedHexString = (o: string): boolean => {
  return 3 === o.length || 4 === o.length
}

const expandHexString = (p: string): string => {
  var c
  var e
  var t
  var ea
  return isReducedHexString(p)
    ? ''
        .concat(p[0])
        .concat(p[0])
        .concat(p[1])
        .concat(p[1])
        .concat(p[2])
        .concat(p[2])
        .concat(null !== (c = p[3]) && void 0 !== c ? c : 'f')
        .concat(null !== (e = p[3]) && void 0 !== e ? e : 'f')
    : ''
        .concat(p[0])
        .concat(p[1])
        .concat(p[2])
        .concat(p[3])
        .concat(p[4])
        .concat(p[5])
        .concat(null !== (t = p[6]) && void 0 !== t ? t : 'f')
        .concat(null !== (ea = p[7]) && void 0 !== ea ? ea : 'f')
}

const splitHexString = (canCreateDiscussions: string): string[][] => {
  return [
    [canCreateDiscussions[0], canCreateDiscussions[1]],
    [canCreateDiscussions[2], canCreateDiscussions[3]],
    [canCreateDiscussions[4], canCreateDiscussions[5]],
    [canCreateDiscussions[6], canCreateDiscussions[7]],
  ]
}

const hexToP3Base = (mmCoreSplitViewBlock: string): string => {
  const eventHandlersByType: string[] = splitHexString(
    expandHexString(trimHash(mmCoreSplitViewBlock)),
  )
    .map(hexToNum)
    .map((o) => {
      return (o / 255).toFixed(2)
    })
  return 'color(display-p3 '
    .concat(eventHandlersByType[0], ' ')
    .concat(eventHandlersByType[1], ' ')
    .concat(eventHandlersByType[2], ' / ')
    .concat(eventHandlersByType[3], ')')
}

export const hexToP3 = (path: string): string => {
  if ('string' !== typeof path || '#' !== path[0]) {
    throw new Error('Invalid hex string!')
  }
  return hexToP3Base(path)
}

