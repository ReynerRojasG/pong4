# Pong 4

## Descripcion

Pong 4 es un juego de Pong de cuatro lados construido con Vite, Phaser, Express y Socket.IO. Incluye lobby, salas privadas y una partida en tiempo real donde el servidor controla paletas, pelota, colisiones, goles, puntaje y tiempo.

## Requisitos

- Node.js 20.19.0 o superior.
- npm.

## Instalacion

Desde la raiz del repositorio:

```powershell
npm ci
```

## Desarrollo

Inicie el servidor en una terminal:

```powershell
npm run dev:server
```

Inicie el cliente en otra terminal:

```powershell
npm run dev
```

El cliente usa `http://127.0.0.1:5173` y el servidor usa `http://127.0.0.1:3000` por defecto. El estado del servidor esta disponible en `GET /health` e incluye la cantidad de salas y partidas activas.

Las variables disponibles estan documentadas en `.env.example`. `CLIENT_ORIGIN` permite varios origenes separados por comas y `VITE_SERVER_URL` cambia la URL usada por el cliente.

## Probar cuatro jugadores

1. Abra `http://127.0.0.1:5173` en cuatro ventanas o perfiles del navegador.
2. En la primera ventana escriba un nombre y seleccione `CREAR SALA`.
3. Copie el codigo de seis caracteres mostrado por el lobby.
4. En las otras tres ventanas escriba un nombre, el codigo y seleccione `UNIRME`.
5. Confirme `ESTOY LISTO` en las cuatro ventanas.
6. El lobby mostrara `Todos estan listos` y abrira el mismo estado de partida en cada cliente.

Si el backend no esta disponible, `JUGAR EN MODO LOCAL` mantiene accesible el prototipo sin salas.

## Comandos

- `npm run dev`: inicia Vite.
- `npm run dev:client`: alias explicito para iniciar Vite.
- `npm run dev:server`: inicia el servidor y lo reinicia al detectar cambios.
- `npm start`: inicia el servidor sin modo watch.
- `npm test`: ejecuta pruebas unitarias y de integracion.
- `npm run build`: genera el cliente de produccion.
- `npm run check`: revisa sintaxis, ejecuta pruebas y genera el build.

## Protocolo de salas

Cada sala admite un maximo de cuatro jugadores. Los espacios se asignan en este orden y se mantienen mientras el jugador siga conectado:

1. PC1: `left`.
2. PC2: `top`.
3. PC3: `right`.
4. PC4: `bottom`.

La partida cambia de `lobby` a `ready` cuando existen cuatro jugadores y todos confirmaron que estan listos. Si alguien cancela su estado o se desconecta, la sala vuelve a `lobby`. Una sala vacia se elimina.

Eventos enviados por el cliente:

- `room:create`
- `room:join`
- `room:leave`
- `room:set-ready`
- `match:paddle-input`

Eventos enviados por el servidor:

- `connection:ready`
- `room:state`
- `match:ready`
- `match:state`
- `match:ended`
- `match:error`

Todas las operaciones de sala responden mediante acknowledgement con `{ ok: true }` o un error con codigo estable. Durante la partida, cada cliente envia solamente el objetivo de su propia paleta. El servidor valida el lado asignado y transmite snapshots a todos los jugadores.

La simulacion del servidor funciona a 60 actualizaciones por segundo. Los snapshots se transmiten 20 veces por segundo y Phaser interpola las posiciones para mantener un movimiento visual continuo.

## Modos de juego

En modo local, PC1 es la paleta azul del lado izquierdo y la partida se ejecuta completamente en Phaser.

En una sala, cada cliente controla con el puntero la paleta del lado que recibio en el lobby. El servidor limita la posicion al area asignada, calcula la partida y evita que un socket controle otra paleta.

Cuando la pelota sale por un lado, el punto se asigna al jugador del lado opuesto. El servidor devuelve la pelota al centro, espera una pausa corta y realiza un unico saque.

## Probar el modo de produccion

Genere el build y arranque el servicio unico:

```powershell
npm run build
$env:NODE_ENV = "production"
npm start
```

Abra `http://127.0.0.1:3000`. Express servira el cliente generado y Socket.IO utilizara el mismo origen.

Al terminar:

```powershell
Remove-Item Env:NODE_ENV
```

## Deploy en Railway

El repositorio incluye `railway.json` y esta preparado para un servicio Node.js construido con Railpack.

Railway ejecutara:

- Build: `npm run build`.
- Inicio: `npm start`.
- Health check: `/health`.
- Host: `0.0.0.0`.
- Puerto: valor inyectado mediante `PORT`.

Pasos desde el panel de Railway:

1. Cree un proyecto y conecte este repositorio de GitHub.
2. Seleccione la raiz del repositorio como Root Directory.
3. Genere un dominio publico para el servicio.
4. No configure manualmente `PORT`; Railway lo inyecta.
5. Mantenga una sola replica mientras las salas vivan en memoria.
6. Verifique `https://SU-DOMINIO/health` despues del deploy.

No es necesario definir `VITE_SERVER_URL` para este deploy de un solo servicio. El cliente usa automaticamente el mismo dominio para HTTP y Socket.IO.

## Limites actuales

- No existe recuperacion de sesion despues de una desconexion.
- Las salas y partidas viven en memoria y se pierden si el servicio reinicia.
- El deploy debe usar una sola replica hasta agregar Redis y el adaptador de Socket.IO.
- La duracion de la partida multijugador esta fijada en dos minutos.
