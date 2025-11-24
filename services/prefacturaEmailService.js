import nodemailer from "nodemailer";
import EstudianteUnidad from "../models/estudiante_unidad.js";
import Estudiante from "../models/estudiante.js";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function enviarPrefacturaEmail({ estudianteUnidadId, detalle }) {
  const asignacion = await EstudianteUnidad.findByPk(estudianteUnidadId);
  if (!asignacion) throw new Error("Asignación no encontrada");

  const estudiante = await Estudiante.findByPk(asignacion.estudiante_id);
  if (!estudiante || !estudiante.email) {
    throw new Error("Estudiante sin email");
  }

  const to = estudiante.email;
  const nombre = estudiante.nombre || "";
  const appName = "UniRenta";

  const fechaCorteDate = detalle.fecha_corte
    ? new Date(detalle.fecha_corte)
    : new Date();
  const fechaCorteStr = new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(fechaCorteDate);

  const nombreUnidad = detalle.nombre_unidad || "Unidad asignada";
  const precioBase = Number(detalle.precio_base || 0);
  const servicios = Array.isArray(detalle.servicios) ? detalle.servicios : [];
  const total = Number(detalle.precio_total || precioBase);

  const getServicioNombre = (srv) =>
    srv.nombre || srv.descripcion || "Servicio extra";

  const getServicioPrecio = (srv) =>
    Number(srv.precio ?? srv.precio_snapshot ?? srv.monto ?? 0);

  let filasServiciosHtml = `
    <tr>
      <td style="padding:4px 8px;">
        Unidad: <strong>${nombreUnidad}</strong>
      </td>
      <td style="padding:4px 8px; text-align:right;">
        $${precioBase.toFixed(2)} MXN / mes
      </td>
    </tr>
  `;

  for (const srv of servicios) {
    const nombreSrv = getServicioNombre(srv);
    const precioSrv = getServicioPrecio(srv);

    filasServiciosHtml += `
      <tr>
        <td style="padding:4px 8px;">${nombreSrv}</td>
        <td style="padding:4px 8px; text-align:right;">
          $${precioSrv.toFixed(2)} MXN / mes
        </td>
      </tr>
    `;
  }

  const descripcionCorte = `
Esta es tu pre-factura de la unidad y los servicios extra que tendrás activos en tu siguiente fecha de corte: ${fechaCorteStr}.
  `.trim();

  const subject = "Pre-factura de tus servicios UniRenta";

  const text = `Hola ${nombre},

${descripcionCorte}

Unidad: ${nombreUnidad} - $${precioBase.toFixed(2)} MXN / mes
${
  servicios.length > 0
    ? servicios
        .map(
          (s) =>
            `- ${getServicioNombre(s)}: $${getServicioPrecio(s).toFixed(
              2
            )} MXN / mes`
        )
        .join("\n")
    : "(Sin servicios extra)"
}

TOTAL estimado: $${total.toFixed(2)} MXN / mes

NOTA:
- Esta es una PRE-FACTURA informativa.
- Si realizaste cambios recientemente (agregaste o quitaste servicios),
  esta pre-factura reemplaza cualquier correo anterior, así que
  por favor ignora las versiones viejas y considera solo esta última.

${appName}
`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Pre-factura ${appName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Pacifico&family=Playwrite+DE+SAS&display=swap" rel="stylesheet">
</head>
<body style="margin:0; padding:0; font-family: Arial, Helvetica, sans-serif; background-color:#f6f6f6;">
  <div style="max-width:600px; margin:0 auto; padding:16px;">
    <div style="background:#ffffff; padding:20px; border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,0.08);">
      <h1 style="font-family:'Pacifico', cursive; margin:0 0 4px 0; font-size:28px; color:#333;">
        ${appName}
      </h1>
      <p style="margin:0 0 16px 0; color:#777; font-size:13px;">
        Plataforma de renta de unidades
      </p>

      <h2 style="margin:8px 0 12px 0; font-size:20px; color:#333;">
        Pre-factura de tus servicios extra
      </h2>

      <p style="margin:0 0 8px 0; font-size:14px; color:#333;">
        Hola <strong>${nombre}</strong>,
      </p>

      <p style="margin:0 0 12px 0; font-size:14px; color:#333; line-height:1.5;">
        Esta es tu pre-factura de la unidad y los servicios extra que tendrás activos en tu siguiente fecha de corte:
        <strong>${fechaCorteStr}</strong>.
      </p>

      <p style="margin:0 0 12px 0; font-size:13px; color:#999;">
        Unidad: <strong>${nombreUnidad}</strong>
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-bottom:12px;">
        <thead>
          <tr>
            <th align="left" style="padding:6px 8px; border-bottom:1px solid #ddd; font-size:13px; color:#555;">
              Concepto
            </th>
            <th align="right" style="padding:6px 8px; border-bottom:1px solid #ddd; font-size:13px; color:#555;">
              Importe
            </th>
          </tr>
        </thead>
        <tbody>
          ${filasServiciosHtml}
          <tr>
            <td style="padding:8px 8px; border-top:1px solid #ddd; font-weight:bold;">
              TOTAL estimado
            </td>
            <td style="padding:8px 8px; border-top:1px solid #ddd; text-align:right; font-weight:bold;">
              $${total.toFixed(2)} MXN / mes
            </td>
          </tr>
        </tbody>
      </table>

      <p style="margin:8px 0 0 0; font-size:12px; color:#999; line-height:1.5;">
        <strong>Nota:</strong> Esta es una <strong>pre-factura informativa</strong>. El cobro real se realizará en la fecha de corte indicada,
        de acuerdo con los servicios activos en ese momento.
        <br />
        Si realizaste cambios recientemente (agregaste o quitaste servicios),
        esta pre-factura reemplaza cualquier correo anterior. Por favor,
        ignora las pre-facturas viejas y considera únicamente esta última versión.
      </p>
    </div>

    <p style="margin:12px 0 0 0; font-size:11px; color:#aaa; text-align:center;">
      Este mensaje fue enviado automáticamente por ${appName}.
    </p>
  </div>
</body>
</html>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}
