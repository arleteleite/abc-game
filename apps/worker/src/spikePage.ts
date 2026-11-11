// Página de teste para abrir no celular durante o spike (etapa 2).
// Mede latência, mostra o estado da sala e reconecta com o mesmo identificador.
export const SPIKE_PAGE = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Spike ABC+ GAME</title>
<style>
  body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#f4f8f4;color:#102a1a}
  h1{font-size:20px;margin:0 0 12px;color:#036634}
  button{font-size:18px;padding:14px 18px;margin:6px 6px 6px 0;border:0;border-radius:10px;background:#036634;color:#fff;min-height:48px}
  button.sec{background:#1F5AA6}
  input{font-size:18px;padding:12px;border:1px solid #888;border-radius:8px;width:60%}
  .box{background:#fff;border-radius:10px;padding:12px;margin:10px 0;box-shadow:0 1px 3px #0002}
  #log{font-family:monospace;font-size:12px;white-space:pre-wrap;max-height:240px;overflow:auto}
  .ok{color:#036634;font-weight:700}.bad{color:#b00020;font-weight:700}
</style>
</head>
<body>
<h1>Spike ABC+ GAME</h1>
<div class="box">
  Sala: <input id="room" value="teste1"><br>
  <button id="conectar">Conectar</button>
  <button id="desconectar" class="sec">Desconectar</button>
</div>
<div class="box">
  Status: <span id="status" class="bad">desconectado</span><br>
  Meu id: <span id="meuid"></span><br>
  Reconexões: <span id="reconex">0</span><br>
  Latência (ms): média <span id="lat-avg">-</span> · p95 <span id="lat-p95">-</span> · amostras <span id="lat-n">0</span>
</div>
<div class="box">
  Estado: <span id="estado">-</span><br>
  <button id="jogar">Jogar (passar a vez)</button>
</div>
<div class="box"><div id="log"></div></div>
<script>
(function(){
  var KEY="spike-player-id";
  var id=null;
  try{id=localStorage.getItem(KEY);}catch(e){}
  if(!id){id="p"+Math.random().toString(36).slice(2,8);try{localStorage.setItem(KEY,id);}catch(e){}}
  var $=function(s){return document.getElementById(s)};
  $("meuid").textContent=id;
  var ws=null,pingTimer=null,wantOpen=false,reconex=0,lats=[];
  function log(t){var l=$("log");l.textContent=new Date().toLocaleTimeString()+" "+t+"\\n"+l.textContent;}
  function setStatus(t,ok){var s=$("status");s.textContent=t;s.className=ok?"ok":"bad";}
  function stats(){
    if(!lats.length)return;
    var a=lats.slice().sort(function(x,y){return x-y});
    var avg=a.reduce(function(s,v){return s+v},0)/a.length;
    $("lat-avg").textContent=avg.toFixed(0);
    $("lat-p95").textContent=a[Math.min(a.length-1,Math.floor(a.length*0.95))];
    $("lat-n").textContent=a.length;
  }
  function connect(){
    var proto=location.protocol==="https:"?"wss":"ws";
    ws=new WebSocket(proto+"://"+location.host+"/ws/"+encodeURIComponent($("room").value));
    setStatus("conectando...",false);
    ws.onopen=function(){
      setStatus("conectado",true);
      ws.send(JSON.stringify({type:"join",playerId:id}));
      clearInterval(pingTimer);
      pingTimer=setInterval(function(){if(ws&&ws.readyState===1)ws.send(JSON.stringify({type:"ping",t:Date.now()}));},2000);
    };
    ws.onmessage=function(ev){
      var m=JSON.parse(ev.data);
      if(m.type==="pong"){lats.push(Date.now()-m.t);if(lats.length>200)lats.shift();stats();}
      else if(m.type==="state"||m.type==="joined"){
        var g=m.game;$("estado").textContent="jogadores="+g.players.length+" vez="+(g.players[g.turn]||"-")+" jogadas="+g.moves;
        log(m.type+": "+JSON.stringify(g));
      } else log(ev.data);
    };
    ws.onclose=function(){
      clearInterval(pingTimer);setStatus("desconectado",false);
      if(wantOpen){reconex++;$("reconex").textContent=reconex;log("caiu; tentando reconectar em 1s");setTimeout(connect,1000);}
    };
    ws.onerror=function(){log("erro de conexão");};
  }
  $("conectar").onclick=function(){if(ws&&ws.readyState<=1)return;wantOpen=true;connect();};
  $("desconectar").onclick=function(){wantOpen=false;if(ws)ws.close();};
  $("jogar").onclick=function(){if(ws&&ws.readyState===1)ws.send(JSON.stringify({type:"move"}));};
})();
</script>
</body>
</html>`;
