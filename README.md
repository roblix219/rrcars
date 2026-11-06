# RR CARS · Hojalatería y Pintura

Sistema de gestión para taller automotriz, 100 % local y sin backend. Funciona como **PWA instalable** en Windows (Chrome o Edge) y guarda toda la información en el navegador mediante **IndexedDB**.

- **Administrador único:** creado en el primer arranque; no existe registro público de administradores.
- **Portal de clientes:** registro con aprobación del taller, consulta de sus propios vehículos, órdenes, costos, avances y fotografías.
- **Operación del taller:** clientes, vehículos, órdenes con folio, siete estados de reparación, costos automáticos, fotografías de avance, historial, reportes y respaldos.
- **Sin dependencias en tiempo de ejecución:** HTML5, CSS3 y JavaScript moderno (módulos ES).

---

## 1. Características principales

### Administrador

| Módulo | Funciones |
| --- | --- |
| Dashboard | Indicadores del taller, órdenes activas, entregas vencidas, clientes pendientes, gráficas y actividad reciente. |
| Clientes | Alta, edición, autorización, rechazo, suspensión, ficha con historial, notas internas y eliminación en cascada. |
| Vehículos | Registro y edición de marca, modelo, año, color, placas, daños, servicio y notas. Sin VIN ni fotografía del vehículo. |
| Órdenes | Folio único `RR-AAAA-0001`, cliente y vehículo asociados, fechas, daños, trabajos, observaciones, costos y total automático. |
| Estados | `Recibido → En diagnóstico → Hojalatería → Pintura → En revisión → Terminado → Entregado`, con bitácora de cambios. |
| Fotografías | Carga local de imágenes de avance, compresión automática, límite de 2.5 MB por imagen y galería con visor. |
| Historial | Órdenes terminadas y entregadas con filtros y consulta de detalle. |
| Reportes | Filtros por fecha, estado, servicio y búsqueda; exportación a CSV y PDF. |
| Configuración | Perfil, cambio de contraseña, tema, respaldos, instalación PWA, límites de seguridad y reinicio controlado. |

### Cliente

- Registro con nombre, correo, teléfono y contraseña. La cuenta queda **pendiente** hasta que el administrador la autorice.
- Acceso al portal solo si la cuenta está **activa**. Los estados pendiente, rechazado y suspendido muestran una pantalla informativa.
- Consulta únicamente de sus propios vehículos, órdenes, costos, avances, fotografías e historial.
- Vista de solo lectura: no puede cambiar precios, estados ni acceder a rutas de administración.
- Edición de sus datos personales y cambio de su propia contraseña.

### Transversal

- Sesión persistente al cerrar y volver a abrir el navegador (7 días, o 30 con «Recordarme»).
- Contraseñas con **PBKDF2-SHA256**, sal aleatoria por usuario y 210 000 iteraciones.
- Bloqueo temporal de acceso tras 5 intentos fallidos.
- Tema oscuro/claro persistente, interfaz responsive con barra lateral, modales, notificaciones y estados de carga.
- Protección de rutas por rol y validaciones de formularios en cliente y en servicios.
- Respaldo/restauración JSON con confirmación reforzada y prevención de duplicados.
- Funcionamiento sin conexión una vez cargada la aplicación (app shell en caché).

---

## 2. Tecnologías

- **HTML5** semántico y accesible.
- **CSS3** con variables de diseño, grid/flexbox y temas claro/oscuro.
- **JavaScript ES2022** con módulos nativos (`type="module"`).
- **IndexedDB** como almacenamiento principal: `users`, `vehicles`, `orders`, `photos`, `events`, `settings`.
- **LocalStorage** solo para preferencias y sesión: tema y token de sesión.
- **Web Crypto API** para PBKDF2-SHA256.
- **Canvas API** para gráficas propias; generador PDF propio sin librerías.
- **Service Worker + Web App Manifest** para la PWA.
- **Node.js** únicamente para servir archivos estáticos en local (no es una dependencia de la app).

No se usa React, Vue, Angular, Bootstrap, jQuery ni frameworks de CSS.

---

## 3. Estructura del proyecto

```text
app-hojalateria/
├─ index.html                  Shell HTML de la aplicación
├─ manifest.webmanifest        Metadatos e iconos de la PWA
├─ sw.js                       Service Worker (caché y modo offline)
├─ package.json                Scripts locales (sin dependencias)
├─ server.mjs                  Servidor estático local sin dependencias
├─ INICIAR-RR-CARS.bat         Lanzador para Windows (Node o Python)
├─ css/
│  ├─ base.css                 Reset, variables, tipografía y temas
│  ├─ components.css           Botones, formularios, tablas, modales, toasts
│  ├─ layout.css               Shell, sidebar, topbar y pantallas de acceso
│  └─ views.css                Vistas de dashboard, detalle y reportes
├─ icons/
│  ├─ favicon.svg
│  ├─ icon-32.png
│  ├─ icon-192.png
│  ├─ icon-512.png
│  ├─ icon-maskable-512.png
│  ├─ apple-touch-icon.png
│  └─ maskable.svg
└─ js/
   ├─ app.js                   Arranque, rutas, shell, guardas y menús
   ├─ services.js              Lógica de negocio y acceso a datos
   ├─ core/
   │  ├─ auth.js               Administrador único, registro, login, sesión y roles
   │  ├─ backup.js             Exportación/restauración JSON
   │  ├─ charts.js             Gráficas en canvas
   │  ├─ constants.js          Roles, estados, servicios y costos
   │  ├─ crypto.js             PBKDF2-SHA256 y tokens
   │  ├─ db.js                 Esquema y helpers de IndexedDB
   │  ├─ export.js             Exportación CSV
   │  ├─ icons.js              Iconos SVG
   │  ├─ install.js            Instalación PWA
   │  ├─ pdf.js                Generador PDF
   │  ├─ pwa.js                Registro del Service Worker y actualizaciones
   │  ├─ router.js             Router por hash
   │  ├─ ui.js                 Modales, toasts, galería, timeline y stepper
   │  └─ utils.js              Formatos, validaciones y utilidades
   └─ views/
      ├─ partials.js           Fragmentos reutilizables
      ├─ auth-views.js         Configuración inicial, login y registro
      ├─ admin-dashboard.js
      ├─ admin-clients.js
      ├─ admin-vehicles.js
      ├─ admin-orders.js
      ├─ admin-order-detail.js
      ├─ admin-history.js
      ├─ admin-reports.js
      ├─ admin-settings.js
      ├─ order-modal.js
      ├─ vehicle-modal.js
      ├─ client-dashboard.js
      ├─ client-vehicles.js
      ├─ client-orders.js
      ├─ client-order-detail.js
      ├─ client-history.js
      └─ client-account.js
```

---

## 4. Requisitos

- Windows 10/11 (también funciona en macOS/Linux).
- Google Chrome o Microsoft Edge actualizado.
- Una de estas opciones para servir los archivos:
  - **Node.js 18 o superior** (recomendado; incluye `server.mjs`).
  - **Python 3** (alternativa con `python -m http.server`).
- Espacio libre en el navegador para IndexedDB y fotografías.

> **Importante:** no abras `index.html` con doble clic (`file://`). El Service Worker, el manifest y la instalación PWA requieren `http://localhost`, `http://127.0.0.1` o HTTPS.

---

## 5. Cómo ejecutar la aplicación

### Opción A · Lanzador de Windows (más sencillo)

1. Haz doble clic en **`INICIAR-RR-CARS.bat`**.
2. El lanzador busca Node.js; si no lo encuentra, intenta con Python.
3. Se abrirá el navegador en `http://127.0.0.1:8080/`.

### Opción B · Node.js

Desde la carpeta del proyecto:

```powershell
node server.mjs --open
```

o, si tienes npm:

```powershell
npm start
```

También puedes cambiar el puerto:

```powershell
node server.mjs --port 3000
```

### Opción C · Python

```powershell
python -m http.server 8080 --bind 127.0.0.1
```

Abre manualmente `http://127.0.0.1:8080/` en Chrome o Edge.

> **Mantén siempre el mismo origen.** Los datos de IndexedDB pertenecen al origen (`http://127.0.0.1:8080`). Si cambias de puerto o de `127.0.0.1` a `localhost`, el navegador lo considera otro sitio y parecerá que no hay datos. Usa siempre la misma URL.

---

## 6. Primer arranque y configuración del administrador

1. Abre la aplicación. Si es la primera vez, se mostrará el asistente en `#/setup`.
2. Captura nombre, correo, teléfono y una contraseña segura.
3. Al guardar se crea la **única** cuenta de administrador y la sesión se inicia automáticamente.
4. La cuenta de administrador no puede registrarse desde el formulario público. Una vez creada, el asistente queda bloqueado de forma atómica: no es posible crear una segunda cuenta de administrador.

**Requisitos de contraseña:** mínimo 8 caracteres, al menos una letra y un número. Se recomienda usar una contraseña única y guardarla en un gestor de contraseñas.

### Flujo inicial recomendado

1. Configura el administrador.
2. Ajusta el perfil del taller en **Configuración → Perfil**.
3. Comparte la URL local con el cliente o registra tú la cuenta desde la pantalla de registro.
4. Autoriza la cuenta desde **Clientes → Autorizar**.
5. El cliente inicia sesión, registra su vehículo y el administrador crea la orden.

---

## 7. Uso del panel de administración

### Clientes

- **Autorizar** una cuenta pendiente o reactivar una suspendida.
- **Rechazar** una solicitud; el cliente verá el motivo general y no podrá entrar al portal.
- **Suspender** temporalmente el acceso sin borrar su historial.
- **Editar** nombre, teléfono, correo y notas internas.
- **Eliminar** un cliente con confirmación por texto. La eliminación es en cascada: vehículos, órdenes, fotografías y eventos asociados. Haz un respaldo antes.

### Vehículos

- Se registran desde el portal del cliente o desde el panel administrador.
- Campos: marca, modelo, año, color, placas, descripción de daños, servicio, notas y propietario.
- **No se solicita VIN ni fotografía del vehículo.**
- Las placas no se pueden duplicar.

### Órdenes de servicio

- Se crean desde **Órdenes → Nueva orden** o desde el botón del dashboard.
- El folio se genera automáticamente con el formato `RR-2026-0001`.
- Se guarda una instantánea del cliente y del vehículo para conservar el historial aunque luego cambien sus datos.
- Costos: mano de obra, materiales, pintura, refacciones, otros y descuento.
- El total se calcula automáticamente y no puede ser negativo.
- El cambio de estado se registra en el historial con fecha y nota.
- Al pasar a **Entregado**, se completa la fecha real de entrega si estaba vacía.

### Fotografías de avance

- Se suben desde el detalle de la orden, pestaña **Fotografías**.
- Se aceptan JPG, PNG y WebP; se comprimen a un máximo de 1400 px y 2.5 MB.
- Se almacenan en IndexedDB como Data URL y se incluyen en el respaldo JSON si se mantiene marcada la opción.
- El cliente solo ve las fotografías de sus propias órdenes.

### Historial y reportes

- **Historial:** órdenes terminadas y entregadas, con búsqueda y filtros.
- **Reportes:** rango de fechas, estado, servicio y texto libre; totales, gráficas y exportación.
- **CSV:** se abre en Excel; usa UTF-8 con BOM para conservar acentos.
- **PDF:** reporte imprimible generado localmente, sin enviar datos a internet.

### Configuración

- **Perfil:** nombre, teléfono y correo del administrador.
- **Seguridad:** cambio de contraseña y datos de la sesión.
- **Preferencias:** tema oscuro o claro.
- **Respaldos:** descarga JSON, restauración, uso de almacenamiento y solicitud de almacenamiento persistente.
- **Instalación:** estado de la PWA y botón de instalación.
- **Seguridad local:** límites del modelo sin backend.
- **Zona de riesgo:** reinicio completo de la aplicación con confirmación por texto; descarga un respaldo antes.

---

## 8. Uso del portal de clientes

1. El cliente abre la misma URL y elige **Crear cuenta**.
2. Captura nombre, correo, teléfono y contraseña. La cuenta queda **pendiente**.
3. El administrador la autoriza desde **Clientes**.
4. El cliente inicia sesión y puede:
   - Registrar y editar sus vehículos.
   - Ver sus órdenes, estado, costos, observaciones y fotografías.
   - Consultar su historial de servicios concluidos.
   - Editar su perfil y cambiar su contraseña.
5. Si la cuenta es rechazada o suspendida, el portal muestra una pantalla de bloqueo y no permite consultar información.

El cliente **no** puede cambiar precios, estados, fotografías ni acceder a rutas `/admin/*`. La comprobación se hace tanto en la interfaz como en los servicios de datos.

---

## 9. Instalación como aplicación en Windows

1. Inicia el servidor local (`INICIAR-RR-CARS.bat` o `node server.mjs --open`).
2. Abre `http://127.0.0.1:8080/` en **Chrome** o **Edge**.
3. Espera a que cargue la aplicación y el Service Worker.
4. Instala de una de estas formas:
   - Icono de instalación en la barra de direcciones.
   - Menú del navegador → **Instalar RR CARS** / **Aplicaciones → Instalar este sitio como aplicación**.
   - **Configuración → Instalación → Instalar aplicación** dentro de RR CARS.
5. Confirma. Se creará un acceso directo en el escritorio y en el menú Inicio.

### Consideraciones

- La PWA instalada abre la misma URL y comparte los mismos datos del navegador.
- El modo offline funciona después de la primera visita: el Service Worker guarda el app shell.
- Si el servidor local está apagado, la app instalada puede abrir desde la caché, pero conviene iniciar el servidor para evitar avisos del navegador.
- La instalación requiere `localhost`/`127.0.0.1` o HTTPS, no `file://`.
- Si el navegador no muestra la opción de instalar, verifica que el manifest y `sw.js` respondan correctamente y que hayas visitado la app al menos una vez.

---

## 10. Respaldos y restauración

### Crear un respaldo

1. Entra como administrador.
2. Ve a **Configuración → Respaldos**.
3. Decide si incluir fotografías (aumenta el tamaño del archivo).
4. Pulsa **Descargar respaldo JSON**.
5. Guarda el archivo fuera del equipo, por ejemplo en una unidad externa o nube privada.

El respaldo incluye usuarios (con hashes de contraseña), vehículos, órdenes, costos, fotografías y bitácora. **No incluye** la sesión activa ni las preferencias del navegador.

### Restaurar un respaldo

1. **Configuración → Respaldos → Restaurar desde archivo**.
2. Selecciona el JSON.
3. Escribe `RESTAURAR` en la confirmación.
4. La operación reemplaza **toda** la información actual y cierra la sesión.
5. Inicia sesión con las credenciales incluidas en el respaldo.

### Recomendaciones

- Respalda al menos una vez por semana y antes de eliminar clientes, vehículos u órdenes.
- No edites el JSON a mano: puede corromperse o perder integridad.
- No compartas respaldos: contienen datos personales y hashes de contraseñas.
- Verifica que el archivo descargado abra correctamente antes de confiar en él.
- Si restauras en otro equipo, los datos quedan asociados a ese navegador y origen.

---

## 11. Persistencia y almacenamiento

| Dato | Dónde se guarda |
| --- | --- |
| Usuarios, vehículos, órdenes, costos, fotografías, historial y configuración | IndexedDB `rrcars_db` |
| Sesión y tema | LocalStorage del navegador |
| Caché de la interfaz | Cache Storage del Service Worker |

- Los datos viven **solo en este equipo y en este perfil de navegador**. No se sincronizan entre dispositivos.
- Borrar los datos del sitio, usar modo incógnito o limpiar el perfil del navegador elimina la información.
- El navegador puede borrar almacenamiento bajo presión de espacio. Usa **Solicitar almacenamiento persistente** en Configuración → Respaldos.
- Si abres la app en otro puerto, otro host (`localhost` vs `127.0.0.1`) u otro navegador, verás una base distinta.
- No hay servidor ni copia automática en la nube. El respaldo JSON es la única copia externa.

---

## 12. Seguridad y limitaciones (importante)

Esta aplicación está diseñada para un **equipo de confianza** y uso local. No sustituye un sistema con backend y autenticación centralizada.

- **El control de roles es local.** Las guardas de rutas y los servicios impiden operaciones accidentales y bloquean el acceso desde la interfaz, pero una persona con acceso físico al equipo y conocimientos técnicos puede abrir DevTools, modificar IndexedDB, alterar el código o manipular LocalStorage. No es una barrera inviolable.
- **No hay cifrado en reposo.** Solo las contraseñas se almacenan con PBKDF2-SHA256 y sal aleatoria. Nombres, teléfonos, correos, vehículos, costos y fotografías quedan legibles dentro de IndexedDB.
- **Las contraseñas no se pueden recuperar por correo.** No hay servidor de correo ni recuperación automática. Si un cliente olvida su contraseña, no existe un botón de restablecimiento en el panel: conserva sus credenciales y los respaldos. Como último recurso se puede respaldar, eliminar y volver a crear la cuenta, asumiendo la pérdida de su historial.
- **No hay autenticación de dos factores**, verificación de teléfono ni verificación de correo.
- **Sesiones en LocalStorage.** Cualquiera con acceso al perfil del navegador podría copiar el token de sesión. Cierra sesión en equipos compartidos.
- **Los respaldos contienen información sensible.** Incluyen datos personales e hashes de contraseñas. Guárdalos en un lugar privado y no los envíes por canales inseguros.
- **No expongas el servidor a la red local o a internet** sin HTTPS, autenticación adicional y medidas de seguridad. `server.mjs` escucha en `127.0.0.1` por defecto precisamente para evitarlo.
- **No hay registro a prueba de manipulaciones.** La bitácora es local y puede alterarse con acceso técnico al equipo.
- **No hay soporte multiusuario real ni concurrencia entre dispositivos.** Dos equipos que abran la app tendrán bases distintas.
- Para un taller con varios equipos, empleados con permisos distintos, recuperación de contraseñas o cumplimiento formal, se requiere una aplicación con **backend, base de datos central, HTTPS y autenticación del lado del servidor**.

---

## 13. Pruebas realizadas

La versión entregada fue validada de extremo a extremo en Chrome con un conjunto automatizado de 22 pasos. Todas las pruebas finalizaron sin errores de consola:

1. Arranque limpio y redirección al asistente de configuración.
2. Creación de la única cuenta de administrador.
3. Bloqueo de un segundo administrador.
4. Persistencia de la sesión al recargar.
5. Persistencia del tema claro/oscuro.
6. Cierre de sesión.
7. Registro de cliente desde la interfaz.
8. Bloqueo del portal para cuentas pendientes.
9. Autorización del cliente por el administrador.
10. Inicio de sesión y registro de vehículo por el cliente.
11. Creación de orden con folio `RR-2026-0001` y total automático.
12. Cambio de estado y subida de fotografía de avance.
13. Persistencia de usuarios, vehículos, órdenes, fotografías e historial tras recargar.
14. Vista del cliente con su orden, costos, estado y fotografía, sin controles de edición.
15. Aislamiento: un cliente no puede abrir la orden de otro.
16. Rutas de administrador bloqueadas para clientes.
17. Reportes y exportación CSV/PDF.
18. Respaldo JSON descargado, abierto y validado.
19. Manifest, iconos y Service Worker activos.
20. Recarga sin conexión usando el app shell en caché.
21. Restauración del respaldo y nuevo inicio de sesión.
22. Cliente suspendido pierde el acceso al portal.

### Lista de verificación manual sugerida

- [ ] El primer arranque muestra el asistente y no permite entrar sin administrador.
- [ ] No se puede crear un segundo administrador.
- [ ] Un cliente pendiente no ve el portal; al autorizarlo, sí.
- [ ] El cliente solo ve sus vehículos, órdenes y fotografías.
- [ ] El folio es único y consecutivo por año.
- [ ] El total cambia al editar costos y descuentos.
- [ ] Los siete estados se guardan y quedan en el historial.
- [ ] Una fotografía se comprime y se conserva tras recargar.
- [ ] CSV y PDF descargan con los filtros aplicados.
- [ ] El respaldo restaura todos los datos y evita duplicados.
- [ ] La app se instala desde Chrome/Edge y abre en ventana propia.
- [ ] Sin conexión, la app sigue abriendo tras la primera visita.

---

## 14. Mantenimiento y actualización

1. Haz un respaldo JSON antes de actualizar archivos.
2. Reemplaza los archivos del proyecto.
3. Si cambias CSS, JavaScript o iconos, **incrementa `VERSION` en `sw.js`** (por ejemplo `1.0.1`). Esto fuerza la renovación de la caché del Service Worker.
4. Recarga la aplicación. Si aparece el aviso de nueva versión, acepta **Actualizar**.
5. Verifica que tus datos sigan visibles; los archivos y la base son independientes.

No borres la base de datos al actualizar. Si necesitas reiniciar la app, usa **Configuración → Zona de riesgo → Reiniciar RR CARS** y conserva antes un respaldo.

---

## 15. Solución de problemas

| Problema | Solución |
| --- | --- |
| Al abrir `index.html` no funciona la instalación ni el modo offline | Usa el servidor local: `http://127.0.0.1:8080/`. `file://` no admite Service Worker. |
| «El puerto 8080 ya está ocupado» | Cierra el otro proceso o ejecuta `node server.mjs --port 8081`. Recuerda que cambiar el puerto cambia el origen y la base visible. |
| Los datos «desaparecieron» | Verifica que uses exactamente la misma URL, navegador y perfil. `localhost` y `127.0.0.1` son orígenes distintos. |
| No aparece el botón de instalar | Confirma que estés en Chrome/Edge, en `localhost` o HTTPS, con el manifest y `sw.js` accesibles. Recarga y espera unos segundos. |
| La app muestra una versión antigua | Cierra todas las pestañas, vuelve a abrir, acepta la actualización del Service Worker o incrementa `VERSION` en `sw.js`. |
| No funciona sin conexión | Abre la app al menos una vez con el servidor encendido y espera a que el Service Worker termine de instalarse. |
| El navegador borró los datos | Restaura el último respaldo JSON. Para prevenirlo, concede almacenamiento persistente y respalda con frecuencia. |
| El respaldo no restaura | Verifica que sea un JSON generado por RR CARS, que no esté editado y que escribas `RESTAURAR` en la confirmación. |
| Olvidé la contraseña del administrador | No hay recuperación automática. Restaura un respaldo anterior o reinicia la aplicación desde la zona de riesgo (perderás los datos actuales). |
| Un cliente olvidó su contraseña | No existe restablecimiento desde el panel. Como último recurso, respalda, elimina y vuelve a crear la cuenta, asumiendo la pérdida de su historial. |

---

## 16. Notas finales

- No se incluyen datos de demostración: la aplicación arranca vacía y lista para el asistente inicial.
- Todos los importes se manejan en pesos mexicanos (`MXN`) y se formatean con la configuración regional de México.
- Las fechas se guardan como `YYYY-MM-DD` y se muestran en formato local.
- El proyecto no requiere compilación ni instalación de paquetes para funcionar; `server.mjs` solo sirve los archivos.
- Uso previsto: estación de trabajo única del taller, con respaldos periódicos y acceso físico controlado.
