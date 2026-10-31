// Utilidades compartidas entre la agenda (index.html) y la vista de TV (tv.html).
// Escrito sin sintaxis muy nueva para que funcione en navegadores de TV viejos.
var Agenda = (function () {
  var KEY_STORAGE = "agendaKey";
  var LOCALE = "es-PR";

  function getKey() {
    try {
      return localStorage.getItem(KEY_STORAGE) || "";
    } catch (e) {
      return "";
    }
  }

  function setKey(key) {
    try {
      localStorage.setItem(KEY_STORAGE, key);
    } catch (e) {
      // modo privado: la clave dura solo esta visita
    }
  }

  function clearKey() {
    try {
      localStorage.removeItem(KEY_STORAGE);
    } catch (e) {
      // nada que borrar
    }
  }

  // Permite abrir la agenda con #k=<clave> (el link de TV) sin escribirla.
  function takeKeyFromHash() {
    var match = location.hash.match(/[#&]k=([^&]+)/);
    if (!match) return;
    setKey(decodeURIComponent(match[1]));
    history.replaceState(null, "", location.pathname + location.search);
  }

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function toDateStr(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function today() {
    return toDateStr(new Date());
  }

  function nowTime() {
    var d = new Date();
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function parseDate(str) {
    var p = str.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function addDays(str, days) {
    var d = parseDate(str);
    d.setDate(d.getDate() + days);
    return toDateStr(d);
  }

  function formatDate(str, options) {
    return new Intl.DateTimeFormat(LOCALE, options).format(parseDate(str));
  }

  function formatTime(time) {
    if (!time) return "";
    var p = time.split(":");
    var hour = Number(p[0]);
    return (hour % 12 || 12) + ":" + p[1] + (hour < 12 ? " am" : " pm");
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function api(path, options) {
    options = options || {};
    var headers = { "x-agenda-key": encodeURIComponent(getKey()) };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    return fetch(path, {
      method: options.method || "GET",
      headers: headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    }).then(function (res) {
      return res
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          if (!res.ok) {
            var error = new Error(data.error || "Error " + res.status);
            error.status = res.status;
            error.data = data;
            throw error;
          }
          return data;
        });
    });
  }

  function fetchRange(from, to) {
    return api("/api/agenda?from=" + from + "&to=" + to).then(function (data) {
      return data.items || [];
    });
  }

  return {
    addDays: addDays,
    api: api,
    capitalize: capitalize,
    clearKey: clearKey,
    escapeHtml: escapeHtml,
    fetchRange: fetchRange,
    formatDate: formatDate,
    formatTime: formatTime,
    getKey: getKey,
    nowTime: nowTime,
    parseDate: parseDate,
    setKey: setKey,
    takeKeyFromHash: takeKeyFromHash,
    toDateStr: toDateStr,
    today: today,
  };
})();
