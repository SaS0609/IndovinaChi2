(() => {
  const BROKERS = window.INDOVINA_BROKERS || [
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://broker.emqx.io:8084/mqtt',
    'wss://test.mosquitto.org:8081'
  ];

  window.IndovinaNet = {
    async join(room) {
      if (typeof mqtt === 'undefined') {
        throw new Error('Libreria MQTT non caricata');
      }
      const topic = 'indovina/v2/' + room;
      const cs = [];
      const h = {};
      const seen = new Set();
      const subs = [];
      let last = false;
      let cnt = 0;

      const up = () => cs.some(c => c.connected);
      const brokerCount = () => cs.filter(c => c.connected).length;
      const notify = () => {
        const u = up();
        if (u !== last) {
          last = u;
          subs.forEach(f => {
            try { f(u, brokerCount()); } catch (e) {}
          });
        }
      };

      for (const url of BROKERS) {
        const c = mqtt.connect(url, {
          clientId: 'ind-' + Math.random().toString(16).slice(2, 10),
          reconnectPeriod: 2500,
          connectTimeout: 8000,
          keepalive: 20,
          clean: true
        });
        c.on('connect', () => {
          c.subscribe(topic, { qos: 0 });
          notify();
        });
        c.on('close', notify);
        c.on('offline', notify);
        c.on('error', () => {});
        c.on('message', (t, p) => {
          let m;
          try { m = JSON.parse(p.toString()); } catch (e) { return; }
          if (!m || !m.i || seen.has(m.i)) return;
          seen.add(m.i);
          if (seen.size > 600) {
            const it = seen.values();
            for (let k = 0; k < 200; k++) seen.delete(it.next().value);
          }
          if (h[m.t]) h[m.t]({ data: m.d, sameTab: false });
        });
        cs.push(c);
      }

      await new Promise(r => {
        const t0 = Date.now();
        const iv = setInterval(() => {
          if (up() || Date.now() - t0 > 6000) {
            clearInterval(iv);
            r();
          }
        }, 100);
      });
      last = up();

      return {
        emit: async (t, d) => {
          const p = JSON.stringify({
            i: topic.length + '-' + Date.now().toString(36) + (cnt++) + Math.random().toString(36).slice(2, 6),
            t,
            d
          });
          let ok = false;
          cs.forEach(c => {
            if (c.connected) {
              c.publish(topic, p, { qos: 0 });
              ok = true;
            }
          });
          if (!ok) throw new Error('offline');
        },
        on: (t, f) => { h[t] = f; },
        connected: up,
        brokerCount,
        reconnect: () => {
          cs.forEach(c => {
            try { if (!c.connected) c.reconnect(); } catch (e) {}
          });
        },
        onConnection: f => subs.push(f),
        leave: async () => {
          cs.forEach(c => {
            try { c.end(true); } catch (e) {}
          });
        }
      };
    }
  };

  const wake = () => {
    if (typeof window.resync === 'function' && !document.hidden) window.resync();
  };
  document.addEventListener('visibilitychange', wake);
  addEventListener('online', wake);
})();
