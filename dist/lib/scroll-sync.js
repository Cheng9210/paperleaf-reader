export function mappedScrollTop(sourcePage,targetPage,sourceViewportTop,targetViewportTop,targetScrollTop,boundary){
  const fraction=Math.max(0,Math.min(1,(sourceViewportTop-sourcePage.top)/sourcePage.height));
  const progressTop=targetScrollTop+targetPage.top-targetViewportTop+fraction*targetPage.height;
  if(!boundary?.sourceNext||!boundary?.targetNext||!boundary.viewportHeight)return progressTop;
  const distanceIntoView=sourceViewportTop+boundary.viewportHeight-boundary.sourceNext.top;
  const weight=Math.max(0,Math.min(1,distanceIntoView/(boundary.viewportHeight*.2)));
  const breakTop=targetScrollTop+boundary.targetNext.top-targetViewportTop-(boundary.sourceNext.top-sourceViewportTop);
  return progressTop+(breakTop-progressTop)*weight;
}
