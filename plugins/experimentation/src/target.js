/**
 * Escape a selector.
 * @param selector
 * @returns {string}
 */
function escapeSelector(selector) {
  return selector.replaceAll(/#(\d)/g, '#\\3$1 ');
}

export function enableQAMode() {
  const now = new Date() * 1;
  let qaMode;
  if (window.location.search) {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('at_preview_token');
    const previewIndex = params.get('at_preview_index')?.split('_');
    if (token && previewIndex) {
      const [activityIndex, experienceIndex] = previewIndex;
      qaMode = {
        token,
        listedActivitiesOnly: true,
        previewIndexes: [{ activityIndex, experienceIndex }],
      };
      window.sessionStorage.setItem('at_qamode', JSON.stringify({ ...qaMode, expires: now + 18e5 }));
    }
  }
  if (!qaMode) {
    qaMode = window.sessionStorage.getItem('at_qamode');
    if (qaMode) {
      qaMode = JSON.parse(qaMode);
      if (qaMode.expires < now) {
        qaMode = undefined;
        window.sessionStorage.removeItem('at_qamode');
      } else {
        delete qaMode.expires;
      }
    }
  }
  return qaMode;
}

function applyAction(el, type, content, context) {
  switch (type) {
    case 'insertAfter':
      el.insertAdjacentHTML('afterend', content);
      return true;
    case 'insertBefore':
      el.insertAdjacentHTML('beforebegin', content);
      return true;
    case 'setHtml':
      el.innerHTML = content;
      return true;
    case 'setAttribute': {
      Object.entries(content).forEach(([k, v]) => {
        el.setAttribute(k, v);
      });
      return true;
    }
    case 'setStyle': {
      const priority = content.prioriry === 'important' ? '!important' : '';
      Object.entries(content).forEach(([k, v]) => {
        el.style[context.toCamelCase(k)] = `${v}${priority}`;
      });
      return true;
    }
    default:
      return false;
  }
}

function applyOffers(doc, sectionOrBlock, offers, context) {
  return offers.filter(({ selector, content, type }) => {
    const el = doc.querySelector(escapeSelector(selector));
    if (sectionOrBlock.contains(el)) {
      const res = applyAction(el, type, content, context);
      if (!res) {
        console.error(`operation not yet implemented: ${type}`);
      }
      return !res;
    }
    return true;
  });
}

/**
 * Get all offers from a response.
 * @param data
 * @returns {*[]}
 */
function getApplicableOffers(data) {
  const offers = [];
  const options = data.execute?.pageLoad?.options ?? [];
  options.forEach((option) => {
    if (option.sourceType !== 'target' || option.type !== 'actions') {
      return;
    }
    option.content.forEach((content) => {
      offers.push(content);
    });
  });
  return offers;
}

export default async function personalizePage(document, targetDeliveryPromise, context) {
  // var AT_QA_MODE = 'at_qa_mode=';
  // var isSet = document.cookie.split(';').some(function (cookie) {
  //     return cookie.trim().startsWith(AT_QA_MODE);
  // });
  // if (isSet) {
  //     document.cookie = AT_QA_MODE + '; Path=/; Max-Age=-0;';
  //     var url = window.location.href.split('at_preview_token',2)[0];
  //     window.open(url.substring(0, url.length - 1), '_self', 'noreferrer');
  // }

  // if (window.location.search) {
  //   const params = new URLSearchParams(window.location.search);
  //   const token = params.get('at_preview_token');
  //   const previewIndex = params.get('at_preview_index')?.split('_');
  //   if (token && previewIndex) {
  //     const [activityIndex, experienceIndex] = previewIndex;
  //     qaMode = { token, listedActivitiesOnly: true, previewIndexes: [{ activityIndex, experienceIndex }] };
  //     window.sessionStorage.setItem('at_qamode', JSON.stringify({ ...qaMode, expires: now + 18e5 }));
  //   }
  // }
  const resp = await targetDeliveryPromise;
  const json = await resp.json();

  const config = JSON.parse(window.localStorage.getItem('aem-experimentation') || '{}');
  config.target ||= { id: { tntId: json.id.tntId } };
  config.target.id ||= { tntId: json.id.tntId };
  config.target.id.tntId ||= json.id.tntId;
  window.localStorage.setItem('aem-experimentation', JSON.stringify(config));

  const offers = getApplicableOffers(json);
  if (!offers.length) {
    return false;
  }

  let remainingOffers = offers;
  const applyMutations = (mutations, observer) => {
    for (let i = 0; i < mutations.length; i += 1) {
      remainingOffers = applyOffers(document, mutations[i].target, remainingOffers, context);
      if (!remainingOffers.length) {
        observer.disconnect();
        return;
      }
    }
  };
  const observer = new MutationObserver(applyMutations);
  observer.observe(document.querySelector('main'), {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-block-status', 'data-section-status'],
  });

  return (target) => applyMutations([{ target }]);
}
