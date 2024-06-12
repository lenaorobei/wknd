import { sampleRUM } from './lib-franklin.js';
import { initRumTracking, pushEventToDataLayer } from './adobe-martech/index.js';

// Define RUM tracking function
const track = initRumTracking(sampleRUM, { withRumEnhancer: true });

// Track page views when the page is fully rendered
// The data will be automatically enriched with applied propositions for personalization use cases
track('lazy', () => {
  const { pathname } = window.location;
  pushEventToDataLayer('web.webpagedetails.pageViews', {
    web: {
      webPageDetails: {
        pageViews: {
          value: window.isErrorPage ? 0 : 1,
        },
        isHomePage: window.location.pathname === '/',
      },
    },
  }, {
    __adobe: {
      analytics: {
        channel: pathname.split('/')[1] || 'home',
        connectionType: navigator.connection.effectiveType,
        cookiesEnabled: navigator.cookieEnabled,
        pageName: pathname.split('/').slice(1).join(':') + (pathname.endsWith('/') ? 'home' : ''),
        pageURL: new URL(document.head.querySelector('link[rel="canonical"]').href).pathname,
        pageType: document.head.querySelector('meta[name="template"]')?.content || 'default',
        referrer: document.referrer,
        server: window.location.origin,
        language: document.documentElement.getAttribute('lang'),
        isErrorPage: window.isErrorPage || false,
      },
    },
  });
});

track('cwv', (data) => {
  if (!data.cwv) {
    return;
  }
  pushEventToDataLayer('web.performance.measurements', {
    _sitesinternal: { cwv: data.cwv },
  });
});

track('click', (data) => {
  const { source, target } = data;
  pushEventToDataLayer('web.webinteraction.linkClicks', {
    web: {
      webInteraction: {
        URL: target,
        // eslint-disable-next-line no-nested-ternary
        name: source,
        linkClicks: { value: 1 },
        type: target && new URL(target).origin !== window.location.origin
          ? 'exit'
          : 'other',
      },
    },
  });
});

// // Declare conversionEvent, bufferTimeoutId and tempConversionEvent,
// // outside the convert function to persist them for buffering between
// // subsequent convert calls
// const CONVERSION_EVENT_TIMEOUT_MS = 100;
// let bufferTimeoutId;
// let conversionEvent;
// let tempConversionEvent;
// sampleRUM.always.on('convert', (data) => {
//   debug('convert', data);
//   const { source: conversionName, target: conversionValue, element } = data;
//   // eslint-disable-next-line no-undef
//   if (!element) {
//     return;
//   }

//   function analyticsTrackConversion() {
//     const xdmData = {
//       eventType: 'web.webinteraction.conversion',
//       _sitesinternal: {
//         conversion: {
//           conversionComplete: 1,
//           conversionName,
//           conversionValue,
//         },
//       },
//     };

//     if (element.tagName === 'FORM') {
//       xdmData.eventType = 'web.formFilledOut';
//       const formId = element?.id || element?.dataset?.action;
//       // eslint-disable-next-line no-underscore-dangle
//       xdmData._sitesinternal.form = {
//         ...(formId && { formId }),
//         // don't count as form complete, as this event should be tracked separately,
//         // track only the details of the form together with the conversion
//         formComplete: 0,
//       };
//     } else if (element.tagName === 'A') {
//       xdmData.eventType = 'web.webinteraction.linkClicks';
//       xdmData.web = {
//         webInteraction: {
//           URL: element.href,
//           // eslint-disable-next-line no-nested-ternary
//           name: element.text ? element.text.trim() : (element.innerHTML ? element.innerHTML.trim() : ''),
//           linkClicks: {
//             // don't count as link click, as this event should be tracked separately,
//             // track only the details of the link with the conversion
//             value: 0,
//           },
//           type: 'other',
//         },
//       };
//     }
//     pushEventToDataLayer(xdmData);
//   }

//   if (element.tagName === 'FORM') {
//     conversionEvent = {
//       ...data,
//       event: 'Form Complete',
//     };

//     if (conversionEvent.event === 'Form Complete'
//       // Check for undefined, since target can contain value 0 as well, which is falsy
//       && (data.target === undefined || data.source === undefined)
//     ) {
//       // If a buffer has already been set and tempConversionEvent exists,
//       // merge the two conversionEvent objects to send to alloy
//       if (bufferTimeoutId && tempConversionEvent) {
//         conversionEvent = { ...tempConversionEvent, ...conversionEvent };
//       } else {
//         // Temporarily hold the conversionEvent object until the timeout is complete
//         tempConversionEvent = { ...conversionEvent };

//         // If there is partial form conversion data,
//         // set the timeout buffer to wait for additional data
//         bufferTimeoutId = setTimeout(async () => {
//           analyticsTrackConversion({ ...conversionEvent });
//           tempConversionEvent = undefined;
//           conversionEvent = undefined;
//         }, CONVERSION_EVENT_TIMEOUT_MS);
//       }
//     }
//     return;
//   }

//   analyticsTrackConversion({ ...data });
//   tempConversionEvent = undefined;
//   conversionEvent = undefined;
// });

track('convert', (ev) => pushEventToDataLayer('rum:conversion', { element: ev.source, value: ev.target }));
track('formsubmit', (ev) => pushEventToDataLayer('rum:form-submitted', { element: ev.source, url: ev.target }));
track('navigate', (ev) => pushEventToDataLayer('rum:internal-navigation', { url: ev.source }));
track('search', (ev) => pushEventToDataLayer('rum:search', { element: ev.source, query: ev.target }));
track('nullsearch', (ev) => pushEventToDataLayer('rum:search', { element: ev.source, query: ev.target, hasResults: false }));
track('leave', () => pushEventToDataLayer('rum:page-lost-focus', { duration: performance.now() - performance.timeOrigin }));

// track('viewblock', (ev) => pushEventToDataLayer('rum:block-viewed', { element: ev.source, value: ev.target }));
// track('viewmedia', (ev) => pushEventToDataLayer('rum:media-viewed', { element: ev.source, value: ev.target }));