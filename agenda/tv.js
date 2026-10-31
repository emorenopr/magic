// Vista para TV: solo lectura, letra grande, se actualiza sola cada minuto.
// Escrito sin sintaxis muy nueva para que funcione en navegadores de TV viejos.
(function () {
  var REFRESH_MS = 60000;
  var OVERDUE_DAYS = 60;
  var WEEK_DAYS = 6;
  var MAX_DAY_ROWS = 4;
  var SHIFT_MS = 10 * 60000;

  function $(id) {
    return document.getElementById(id);
  }

  var els = {
    gate: $("tvGate"),
    gateForm: $("tvGateForm"),
    gateInput: $("tvGateInput"),
    gateError: $("tvGateError"),
    tv: $("tv"),
    time: $("tvTime"),
    ampm: $("tvAmPm"),
    weekday: $("tvWeekday"),
    date: $("tvDate"),
    progress: $("tvProgress"),
    progressText: $("tvProgressText"),
    progressBar: $("tvProgressBar"),
    todayBody: $("tvTodayBody"),
    week: $("tvWeek"),
    status: $("tvStatus"),
  };

  var esc = Agenda.escapeHtml;
  var data = null;
  var lastSync = null;
  var offline = false;
  var lastMinute = "";
  var started = false;

  function formatClock(date) {
    var hours = date.getHours();
    var minutes = date.getMinutes();
    return {
      time: (hours % 12 || 12) + ":" + (minutes < 10 ? "0" : "") + minutes,
      ampm: hours < 12 ? "am" : "pm",
    };
  }

  function shortTime(time) {
    var p = time.split(":");
    var hour = Number(p[0]);
    return (hour % 12 || 12) + (p[1] === "00" ? "" : ":" + p[1]) + (hour < 12 ? "am" : "pm");
  }

  function load() {
    var today = Agenda.today();
    return Promise.all([
      Agenda.fetchRange(today, Agenda.addDays(today, WEEK_DAYS)),
      Agenda.fetchRange(Agenda.addDays(today, -OVERDUE_DAYS), Agenda.addDays(today, -1)),
    ])
      .then(function (results) {
        data = {
          today: today,
          items: results[0],
          overdue: results[1].filter(function (item) {
            return !item.done;
          }),
        };
        lastSync = new Date();
        offline = false;
        render();
      })
      .catch(function (error) {
        if (error.status === 401) {
          Agenda.clearKey();
          showGate("Contraseña incorrecta.");
          return;
        }
        offline = true;
        renderStatus();
        if (!data) showGate(error.status === 503 ? error.message : "No se pudo conectar. Revisa el internet.");
      });
  }

  // ---------- render ----------

  function row(item, kind, extra) {
    var classes = ["tv-item", kind];
    if (item.done) classes.push("done");
    if (extra && extra.cls) classes.push(extra.cls);
    var lead =
      kind === "timed"
        ? '<span class="tv-time">' + esc(Agenda.formatTime(item.time)) + "</span>"
        : '<span class="tv-box"></span>';
    var tail = extra && extra.tail ? extra.tail : "";
    var drop = extra && extra.drop !== undefined ? extra.drop : 3;
    return (
      '<li class="' + classes.join(" ") + '" data-drop="' + (item.done ? 0 : drop) + '">' +
      lead + '<span class="tv-title">' + esc(item.title) + "</span>" + tail + "</li>"
    );
  }

  function overflows(el) {
    return el.scrollHeight > el.clientHeight + 1;
  }

  function renderToday() {
    var now = Agenda.nowTime();
    var todays = data.items.filter(function (item) {
      return item.date === data.today;
    });
    var timed = todays.filter(function (item) {
      return item.time;
    });
    var untimed = todays.filter(function (item) {
      return !item.time;
    });

    var nextId = null;
    for (var i = 0; i < timed.length; i += 1) {
      if (!timed[i].done && timed[i].time >= now) {
        nextId = timed[i].id;
        break;
      }
    }

    var groups = [];
    function group(title, items, render, cls) {
      if (!items.length) return;
      groups.push(
        '<h3 class="tv-group ' + (cls || "") + '">' + title + '</h3><ul class="tv-list">' + items.map(render).join("") + "</ul>"
      );
    }

    // drop = en qué orden se esconden si no cabe todo (0 primero):
    // hechas, luego lo que ya pasó, atrasadas, pendientes y por último lo que viene.
    group("Agenda", timed, function (item) {
      if (item.id === nextId) {
        return row(item, "timed", { cls: "next", drop: 9, tail: '<span class="tv-badge">Próximo</span>' });
      }
      var past = item.time < now;
      return row(item, "timed", { cls: past ? "past" : "", drop: past ? 1 : 4 });
    });
    group("Pendientes", untimed, function (item) {
      return row(item, "todo", { drop: 3 });
    });
    group(
      "Atrasadas",
      data.overdue,
      function (item) {
        var from = Agenda.formatDate(item.date, { weekday: "short", day: "numeric" }).replace(".", "");
        return row(item, "todo", { cls: "late", drop: 2, tail: '<span class="tv-from">' + esc(from) + "</span>" });
      },
      "late"
    );

    els.todayBody.innerHTML = groups.length
      ? groups.join("")
      : '<div class="tv-empty"><span>Nada anotado para hoy</span><small>Día libre ✨</small></div>';
    fitToday();

    var done = todays.filter(function (item) {
      return item.done;
    }).length;
    els.progress.hidden = todays.length === 0;
    els.progressText.textContent = done + " de " + todays.length + " hechas";
    els.progressBar.style.width = (todays.length ? Math.round((done / todays.length) * 100) : 0) + "%";
  }

  // Si no cabe todo, esconde filas según su prioridad (data-drop) y dice
  // cuántas quedaron fuera, en vez de cortarlas a la mitad.
  function fitToday() {
    var body = els.todayBody;
    if (!overflows(body)) return;
    var rows = Array.prototype.slice.call(body.querySelectorAll(".tv-item")).map(function (el, index) {
      var drop = Number(el.getAttribute("data-drop"));
      // Lo hecho y lo que ya pasó se esconde de arriba hacia abajo; lo demás, de abajo hacia arriba.
      return { el: el, drop: drop, order: drop <= 1 ? index : -index };
    });
    rows.sort(function (a, b) {
      return a.drop - b.drop || a.order - b.order;
    });

    var more = document.createElement("p");
    more.className = "tv-more";
    body.appendChild(more);
    for (var i = 0; i < rows.length - 1 && overflows(body); i += 1) {
      var list = rows[i].el.parentNode;
      list.removeChild(rows[i].el);
      if (!list.children.length) {
        body.removeChild(list.previousElementSibling);
        body.removeChild(list);
      }
      more.textContent = "+" + (i + 1) + " más en la agenda";
    }
  }

  function dayBlock(date, d, maxRows) {
    var items = data.items.filter(function (item) {
      return item.date === date;
    });
    var name = d === 1 ? "Mañana" : Agenda.capitalize(Agenda.formatDate(date, { weekday: "long" }));
    var list = '<p class="tv-free">Libre</p>';
    if (items.length) {
      list =
        "<ul>" +
        items
          .slice(0, maxRows)
          .map(function (item) {
            return (
              '<li class="' + (item.done ? "done" : "") + '">' +
              (item.time ? "<b>" + shortTime(item.time) + "</b> " : '<i class="tv-dot"></i>') +
              esc(item.title) +
              "</li>"
            );
          })
          .join("") +
        "</ul>";
    }
    var extra = items.length > maxRows ? '<span class="tv-day-more">+' + (items.length - maxRows) + "</span>" : "";
    return (
      '<div class="tv-day' + (items.length ? "" : " empty") + '">' +
      '<div class="tv-day-label"><span class="tv-day-name">' + esc(name) + "</span>" +
      '<span class="tv-day-num">' + esc(Agenda.formatDate(date, { day: "numeric" })) + "</span></div>" +
      list +
      extra +
      "</div>"
    );
  }

  function renderWeek() {
    var dates = [];
    var counts = [];
    var rows = [];
    for (var d = 1; d <= WEEK_DAYS; d += 1) {
      var date = Agenda.addDays(data.today, d);
      dates.push(date);
      counts.push(
        data.items.filter(function (item) {
          return item.date === date;
        }).length
      );
      rows.push(1);
    }

    function draw() {
      els.week.innerHTML = dates
        .map(function (date, i) {
          return dayBlock(date, i + 1, rows[i]);
        })
        .join("");
    }

    // Empieza con una línea por día y le va dando más a cada día (mañana
    // primero) mientras quepa en la pantalla.
    draw();
    var grew = true;
    while (grew) {
      grew = false;
      for (var i = 0; i < rows.length; i += 1) {
        if (rows[i] >= Math.min(counts[i], MAX_DAY_ROWS)) continue;
        rows[i] += 1;
        draw();
        if (overflows(els.week)) {
          rows[i] -= 1;
          counts[i] = rows[i]; // este día ya no crece más
          draw();
        } else {
          grew = true;
        }
      }
    }
  }

  function renderStatus() {
    if (!lastSync) {
      els.status.textContent = "";
      return;
    }
    var clock = formatClock(lastSync);
    var at = clock.time + " " + clock.ampm;
    els.status.textContent = offline ? "Sin conexión · mostrando lo de las " + at : "Actualizado " + at;
    els.status.className = offline ? "offline" : "";
  }

  function render() {
    if (!data) return;
    els.gate.hidden = true;
    els.tv.hidden = false;
    renderToday();
    renderWeek();
    renderStatus();
  }

  function tick() {
    var now = new Date();
    var clock = formatClock(now);
    if (clock.time === lastMinute) return;
    lastMinute = clock.time;

    els.time.textContent = clock.time;
    els.ampm.textContent = clock.ampm;
    var today = Agenda.today();
    els.weekday.textContent = Agenda.capitalize(Agenda.formatDate(today, { weekday: "long" }));
    els.date.textContent = Agenda.formatDate(today, { day: "numeric", month: "long", year: "numeric" });

    if (data && data.today !== today) {
      load();
    } else {
      render(); // para que "Próximo" avance con la hora
    }
  }

  // Mueve todo unos pocos píxeles de vez en cuando para no marcar la pantalla.
  function shiftPixels() {
    var x = Math.round(Math.random() * 16 - 8);
    var y = Math.round(Math.random() * 12 - 6);
    els.tv.style.transform = "translate(" + x + "px, " + y + "px)";
  }

  function keepAwake() {
    if (navigator.wakeLock && navigator.wakeLock.request) {
      navigator.wakeLock.request("screen").catch(function () {});
    }
  }

  function showGate(message) {
    els.tv.hidden = true;
    els.gate.hidden = false;
    els.gateError.hidden = !message;
    els.gateError.textContent = message || "";
  }

  function start() {
    load();
    if (started) return;
    started = true;
    tick();
    setInterval(tick, 1000);
    setInterval(load, REFRESH_MS);
    setInterval(shiftPixels, SHIFT_MS);
    keepAwake();
  }

  els.gateForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!els.gateInput.value) return;
    Agenda.setKey(els.gateInput.value);
    els.gateInput.value = "";
    start();
  });

  // Con el control de la TV: OK / clic pone o quita la pantalla completa.
  els.tv.addEventListener("click", function () {
    var root = document.documentElement;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (root.requestFullscreen) {
      root.requestFullscreen().catch(function () {});
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && started) {
      keepAwake();
      load();
    }
  });

  window.addEventListener("resize", render);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);

  Agenda.takeKeyFromHash();
  if (Agenda.getKey()) {
    start();
  } else {
    showGate();
  }
})();
