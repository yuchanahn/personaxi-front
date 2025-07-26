function a(n){return function(...t){var o=t[0];o.target===this&&n?.apply(this,t)}}function e(n){return function(...t){var o=t[0];return o.stopPropagation(),n?.apply(this,t)}}export{a,e as s};
