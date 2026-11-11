export function mappedScrollTop(sourcePage,targetPage,sourceViewportTop,targetViewportTop,targetScrollTop){
  const fraction=Math.max(0,Math.min(1,(sourceViewportTop-sourcePage.top)/sourcePage.height));
  return targetScrollTop+targetPage.top-targetViewportTop+fraction*targetPage.height;
}
