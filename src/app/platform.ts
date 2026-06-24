export const isApplePlatform = (): boolean => {
  if (typeof navigator === 'undefined') {
    return false
  }

  const userAgentData = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData
  const platform = userAgentData?.platform ?? navigator.platform ?? ''
  if (/mac|iphone|ipad|ipod/i.test(platform)) {
    return true
  }

  const userAgent = navigator.userAgent ?? ''
  return /macintosh|iphone|ipad|ipod/i.test(userAgent)
}

export const usesMetaForCommand = isApplePlatform()
