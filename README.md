# Pong 4

## Descripcion

Pong 4 es un prototipo de Pong de cuatro lados construido con Vite, Phaser, Express y Socket.IO. La fase actual conserva el juego local y agrega la base del modo multijugador: salas, cuatro espacios fijos, estado de preparacion y limpieza al desconectarse.

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

El cliente usa `http://127.0.0.1:5173` y el servidor usa `http://127.0.0.1:3000` por defecto. El estado del servidor esta disponible en `GET /health`.

Las variables disponibles estan documentadas en `.env.example`. `CLIENT_ORIGIN` permite varios origenes separados por comas y `VITE_SERVER_URL` cambia la URL usada por el cliente.

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

Eventos enviados por el servidor:

- `connection:ready`
- `room:state`
- `match:ready`

Todas las operaciones de sala responden mediante acknowledgement con `{ ok: true }` o un error con codigo estable. El cliente reutilizable se encuentra en `src/network/MultiplayerClient.js`.

## Juego local actual

PC1 es la paleta azul del lado izquierdo. Se controla moviendo el puntero dentro de su zona. La posicion se limita automaticamente al area asignada a PC1.

Cuando la pelota sale por un lado, el punto se asigna al jugador del lado opuesto. La pelota vuelve al centro, espera una pausa corta y realiza un unico saque.

## Limites de esta fase

- La pantalla del juego aun no crea ni muestra salas.
- El servidor aun no controla la fisica, la pelota, las paletas ni el puntaje.
- No existe recuperacion de sesion despues de una desconexion.
- Solo una paleta tiene control en el juego local.
- Railway aun no esta configurado.
