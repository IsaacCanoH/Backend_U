import express from 'express'; 
import cors from 'cors';

import { manejadorErrores } from "./utils/errores/manejadorErrores.js";

import propiedadRoutes from './routes/propiedadRoutes.js';
import renteroRoutes from './routes/renteroRoutes.js';
import documentoRoutes from './routes/documentoRoutes.js';
import universidadRoutes from './routes/universidadRoutes.js';
import EstudianteRoutes from './routes/estudianteRoutes.js';
import serviciosRoutes from './routes/serviciosRoutes.js';

import Unidad from './models/unidad.js';
import Propiedad from './models/propiedad.js';
import Rentero from './models/rentero.js';
import Estudiante from './models/estudiante.js';
import EstudianteUnidad from './models/estudiante_unidad.js';
import Servicio from './models/servicio.js';
import EstudianteUnidadServicio from './models/estudiante_unidad_servicio.js';

Unidad.belongsTo(Propiedad, { foreignKey: 'propiedad_id', as: 'propiedad' });
Propiedad.belongsTo(Rentero, { foreignKey: 'rentero_id', as: 'rentero' });
EstudianteUnidad.belongsTo(Unidad, { foreignKey: 'unidad_id', as: 'unidad' });
EstudianteUnidad.belongsTo(Estudiante, { foreignKey: 'estudiante_id', as: 'estudiante' });

const app = express(); 

// Configuración de CORS
app.use(cors({
  origin: 'http://localhost:4200',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

app.use('/propiedades', propiedadRoutes);
app.use('/rentero', renteroRoutes);
app.use('/estudiante', EstudianteRoutes);
app.use('/documentos', documentoRoutes);
app.use('/universidades', universidadRoutes);
app.use('/servicios', serviciosRoutes);


app.use(manejadorErrores);

export default app;