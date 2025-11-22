# Documentación del apartado de lógica de Negocio de uniRenta.

## RF02 Validación Automatáica de Documentos.

### Introducción
La funcionalidad de validación automática de documentos en uniRenta permite procesar y verificar documentos subidos por usuarios (identificación y propiedades) utilizando OCR (Reconocimiento Óptico de Caracteres) para extraer texto y validarlo contra requisitos predefinidos. Esto asegura que los documentos sean auténticos y contengan la información necesaria antes de guardarlos en la base de datos. El proceso sigue principios de arquitectura limpia, como SRP (Single Responsibility Principle), y es modular para facilitar mantenimiento y extensiones.

### Archivos Involucrados y sus Responsabilidades
- **utils/ocr/ocrApi.js**:
  - Responsabilidad: Extraer texto de imágenes usando la API de OCR.Space.
  - Funciones clave: Crea formularios, envía solicitudes HTTP, valida respuestas y maneja errores con reintentos para robustez.
  - Cumple SRP: Sí, enfocado solo en integración con OCR.

- **utils/ocr/validadorCamposOCR.js**:
  - Responsabilidad: Validar si los campos requeridos (e.g., nombre, tipo de documento) están presentes en el texto extraído, usando algoritmos de similitud (Levenshtein).
  - Funciones clave: Normaliza texto, calcula similitud y evalúa umbrales para aprobación.
  - Cumple SRP: Sí, solo validación de contenido.

- **utils/ocr/validarDocumento.js**:
  - Responsabilidad: Orquestar la extracción de texto y validación de campos.
  - Funciones clave: Llama a `ocrApi` y `verificarDatos` en secuencia.
  - Cumple SRP: Sí, actúa como coordinador sin lógica adicional.

- **services/documentoService.js**:
  - Responsabilidad: Procesar documentos completos (validar, mover archivos y guardar en BD).
  - Funciones clave: Integra validación OCR con almacenamiento, usando transacciones.
  - Cumple SRP: Sí, separa lógica de negocio de documentos.

- **services/renteroService.js**:
  - Responsabilidad: Gestionar operaciones de renteros, incluyendo validación de documentos en registro.
  - Funciones clave: Usa `documentoService` para validar durante creación de renteros.
  - Cumple SRP: Sí, enfocado en renteros.

- **controllers/renteroController.js**:
  - Responsabilidad: Manejar solicitudes HTTP para operaciones de renteros.
  - Funciones clave: Recibe uploads y delega a servicios.
  - Cumple SRP: Sí, solo endpoints.

- **utils/errores/erroresDocumento.js**:
  - Responsabilidad: Definir errores personalizados (e.g., ErrorOCR, ErrorValidacionDocumento).
  - Funciones clave: Clases de error con detalles para manejo consistente.
  - Cumple SRP: Sí, centraliza definiciones.

### Flujo de Ejecución
1. **Solicitud HTTP**: El usuario sube un documento via endpoint (ejemplo: registro de rentero) a `renteroController.js`.
2. **Validación Inicial**: El controller verifica el archivo y llama a `renteroService.js`.
3. **Procesamiento de Documento**: `renteroService.js` pasa a `documentoService.js`, que invoca `validarDocumento.js`.
4. **Extracción de Texto**: `validarDocumento.js` llama a `ocrApi.js` para extraer texto de la imagen.
5. **Validación de Campos**: El texto se pasa a `validadorCamposOCR.js` para verificar contra campos requeridos (ejemplo: nombre, umbrales de similitud).
6. **Manejo de Errores**: Si hay fallos, se lanzan errores específicos (ejemplo: timeout, campos faltantes) con detalles.
7. **Almacenamiento**: Si pasa validación, el archivo se mueve y guarda en BD via `documentoService.js`.
8. **Respuesta**: Se devuelve éxito o error al cliente.

### Mantenibilidad y Mejores Prácticas
- **Modularidad**: Cada módulo tiene una función clara, facilitando tests y cambios.
- **Manejo de Errores**: Jerárquico y detallado, con clases personalizadas.
- **Configuración**: Usa variables de entorno (ejemplo: API keys, umbrales).
- **Robustez**: Incluye reintentos en OCR para manejar timeouts.
- **Extensibilidad**: Fácil agregar tipos de documentos nuevos via BD.

### Explicación Detallada de `ocrApi.js` (Versión Refactorizada)
El archivo `ocrApi.js` es el módulo central para la extracción de texto de documentos usando la API de OCR.Space. Ha sido refactorizado para mejorar robustez contra timeouts y errores intermitentes, sin alterar la lógica principal.

#### Funcionalidad Principal
- **Propósito**: Recibe la ruta de un archivo de imagen/PDF y devuelve el texto extraído. Maneja errores con reintentos automáticos para evitar fallos por latencia de red.
- **Flujo General**:
  1. **Validación Inicial**: Verifica que el archivo exista y sea accesible usando `fs.promises.access`.
  2. **Reintentos con Backoff**: Si falla (ejemplo: timeout), reintenta hasta 3 veces con delay exponencial (1s, 2s, 4s).
  3. **Creación de Formulario**: Crea un `FormData` con el archivo, idioma (español) y opciones.
  4. **Envío de Solicitud**: Envía POST a OCR.Space con Axios, configurado para timeouts y validación de status.
  5. **Validación de Respuesta**: Verifica si la API procesó correctamente y extrajo texto.
  6. **Retorno o Error**: Devuelve texto o lanza `ErrorOCR` formateado.


- **Reintentos Automáticos**: Implementa loop con backoff exponencial para errores recuperables (ejemplo: timeout, conexión), reduciendo fallos intermitentes sin cambiar lógica.
- **Validación de Archivos**: Nueva función `validarExistenciaArchivo` previene errores tempranos.
- **Manejo de Streams**: Optimiza `createReadStream` con `highWaterMark` para archivos grandes y cierra streams en `finally` para evitar leaks.
- **Configuraciones Centralizadas**: Usa objeto `CONFIGURACION_REINTENTOS` para timeout y reintentos, facilitando ajustes.
- **Logging y Errores Mejorados**: Agrega detalles en errores finales (ejemplo: número de intentos) y valida status HTTP para manejar errores de servidor.
- **Robustez**: Solo reintenta errores recuperables (no para errores de configuración o procesamiento), manteniendo eficiencia.

#### Funciones Detalladas
- **ocrApi (Principal)**: Async, valida archivo, maneja reintentos y errores.
- **validarExistenciaArchivo**: Verifica acceso al archivo.
- **esErrorRecuperable**: Determina si reintentar basado en tipo de error.
- **esperar**: Delay para backoff.
- **crearFormulario**: Prepara FormData con optimizaciones.
- **enviarSolicitudOCR**: Configura Axios con timeout y validación.
- **validarRespuestaOCR y validarTextoExtraido**: Verifican respuesta y texto.
- **procesarErrorFinal**: Formatea errores después de reintentos.

#### Ejemplo de Uso
```javascript
const texto = await ocrApi('/ruta/archivo.pdf');
// Retorna texto extraído o lanza ErrorOCR si falla.
```