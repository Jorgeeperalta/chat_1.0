# Genera los íconos de la PWA a partir de frontend/branding/converxa.jpeg
# Uso (desde la raíz del repo):
#   & .\scripts\generate-icons.ps1 -Source frontend/branding/converxa.jpeg -OutDir frontend/public/icons
# Después: node scripts/build-deploy.js
param([string]$Source, [string]$OutDir, [switch]$AnalyzeOnly)

# System.Drawing resuelve rutas relativas contra su propio directorio, no el de PowerShell
$Source = (Resolve-Path $Source).Path
$OutDir = (Resolve-Path $OutDir).Path

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class IconTool {
    static bool Dark(Color c) { return Math.Min(c.R, Math.Min(c.G, c.B)) < 200; }
    // mode 0: blanco (texto), 1: color vivo (logo)
    static bool Match(Color c, int mode) {
        if (mode == 0) return Math.Min(c.R, Math.Min(c.G, c.B)) > 200;
        return c.G > 110 || (c.R > 110 && c.B > 200);
    }

    // Píxeles desde (x,y) en dirección (dx,dy) hasta llegar al fondo oscuro
    public static int FirstDark(Bitmap b, int x, int y, int dx, int dy) {
        for (int i = 0; i < 300; i++) { if (Dark(b.GetPixel(x + dx * i, y + dy * i))) return i; }
        return -1;
    }

    // Rectángulo del contenido claro dentro de [x0,x1)x[y0,y1)
    public static Rectangle Bounds(Bitmap b, int x0, int y0, int x1, int y1, int mode) {
        int minX = int.MaxValue, minY = int.MaxValue, maxX = -1, maxY = -1;
        for (int y = y0; y < y1; y++) for (int x = x0; x < x1; x++) {
            Color c = b.GetPixel(x, y);
            if (Match(c, mode)) {
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
        }
        return maxX < 0 ? Rectangle.Empty : Rectangle.FromLTRB(minX, minY, maxX + 1, maxY + 1);
    }

    static Graphics HQ(Bitmap bmp) {
        Graphics g = Graphics.FromImage(bmp);
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        g.CompositingQuality = CompositingQuality.HighQuality;
        return g;
    }

    public static Bitmap Crop(Bitmap src, Rectangle r) {
        Bitmap bmp = new Bitmap(r.Width, r.Height, PixelFormat.Format32bppArgb);
        using (Graphics g = HQ(bmp)) g.DrawImage(src, new Rectangle(0, 0, r.Width, r.Height), r, GraphicsUnit.Pixel);
        return bmp;
    }

    // Cuadrado opaco de borde a borde (iOS y Android redondean por su cuenta)
    public static void SaveSquare(Bitmap src, int size, string path) {
        using (Bitmap bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb))
        using (Graphics g = HQ(bmp)) {
            g.DrawImage(src, 0, 0, size, size);
            bmp.Save(path, ImageFormat.Png);
        }
    }

    // Esquinas redondeadas transparentes (ícono "any": escritorio, favicon)
    public static void SaveRounded(Bitmap src, int size, double radiusRatio, string path) {
        using (Bitmap scaled = new Bitmap(size, size, PixelFormat.Format32bppArgb))
        using (Bitmap bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb)) {
            using (Graphics g = HQ(scaled)) g.DrawImage(src, 0, 0, size, size);
            using (Graphics g = HQ(bmp))
            using (TextureBrush brush = new TextureBrush(scaled))
            using (GraphicsPath p = RoundRect(0, 0, size, size, (float)(size * radiusRatio))) {
                g.Clear(Color.Transparent);
                g.FillPath(brush, p);
            }
            bmp.Save(path, ImageFormat.Png);
        }
    }

    // Maskable: fondo liso + logo centrado dentro de la zona segura (círculo del 80%)
    public static void SaveMaskable(Bitmap logo, int size, double logoRatio, Color bg, string path) {
        using (Bitmap bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb))
        using (Graphics g = HQ(bmp)) {
            g.Clear(bg);
            int w = (int)(size * logoRatio);
            int h = (int)Math.Round(w * (double)logo.Height / logo.Width);
            g.DrawImage(logo, (size - w) / 2, (size - h) / 2, w, h);
            bmp.Save(path, ImageFormat.Png);
        }
    }

    static GraphicsPath RoundRect(float x, float y, float w, float h, float r) {
        GraphicsPath p = new GraphicsPath();
        float d = r * 2;
        p.AddArc(x, y, d, d, 180, 90);
        p.AddArc(x + w - d, y, d, d, 270, 90);
        p.AddArc(x + w - d, y + h - d, d, d, 0, 90);
        p.AddArc(x, y + h - d, d, d, 90, 90);
        p.CloseFigure();
        return p;
    }
}
'@

$img = [System.Drawing.Bitmap]::FromFile($Source)
$W = $img.Width; $H = $img.Height
$tl = [IconTool]::FirstDark($img, 0, 0, 1, 1)
$br = [IconTool]::FirstDark($img, $W - 1, $H - 1, -1, -1)
$top = [IconTool]::FirstDark($img, [int]($W / 2), 0, 0, 1)
$left = [IconTool]::FirstDark($img, 0, [int]($H / 2), 1, 0)
"tamaño ${W}x${H} | esquina TL=$tl BR=$br | borde top=$top left=$left"

$inner = 70
$all = [IconTool]::Bounds($img, $inner, $inner, $W - $inner, $H - $inner, 0)
"texto blanco: $all"
$logo = [IconTool]::Bounds($img, $inner, $inner, $W - $inner, 430, 1)
"logo C (sin texto): $logo"

if ($AnalyzeOnly) { $img.Dispose(); return }

# ---------- Generación ----------
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
public static class Feather {
    // Desvanece los bordes del recorte (alfa radial) para fundirlo con un fondo liso
    public static void Apply(Bitmap b, double solidRatio) {
        double cx = b.Width / 2.0, cy = b.Height / 2.0, rMax = Math.Min(cx, cy), rSolid = rMax * solidRatio;
        for (int y = 0; y < b.Height; y++) for (int x = 0; x < b.Width; x++) {
            double d = Math.Sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
            double a = d <= rSolid ? 1 : d >= rMax ? 0 : 1 - (d - rSolid) / (rMax - rSolid);
            Color c = b.GetPixel(x, y);
            b.SetPixel(x, y, Color.FromArgb((int)(c.A * a * a * (3 - 2 * a)), c.R, c.G, c.B));
        }
    }
}
'@

$base = [IconTool]::Crop($img, (New-Object System.Drawing.Rectangle 60, 60, 532, 532))
[IconTool]::SaveSquare($base, 180, "$OutDir\apple-touch-icon-180x180.png")
[IconTool]::SaveRounded($base, 512, 0.22, "$OutDir\pwa-512x512.png")
[IconTool]::SaveRounded($base, 192, 0.22, "$OutDir\pwa-192x192.png")

# Logo C: cuadrado de 380 px centrado en la C (termina antes del texto, que empieza en y=449)
$cx = $logo.X + [int]($logo.Width / 2); $cy = $logo.Y + [int]($logo.Height / 2)
$side = 380
$logoCrop = [IconTool]::Crop($img, (New-Object System.Drawing.Rectangle ($cx - $side / 2), ($cy - $side / 2), $side, $side))
[Feather]::Apply($logoCrop, 0.62)
$bg = [System.Drawing.ColorTranslator]::FromHtml('#050A2A')
# La C ocupa ~76% del recorte: a 0.70 del ícono queda en ~53%, dentro del círculo seguro del 80%
[IconTool]::SaveMaskable($logoCrop, 512, 0.70, $bg, "$OutDir\maskable-512x512.png")

# Favicon: la C sola (el texto no se lee a 32 px), con esquinas redondeadas
$fav = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($fav); $g.InterpolationMode = 'HighQualityBicubic'; $g.Clear($bg)
$g.DrawImage($logoCrop, -14, -14, 284, 284); $g.Dispose()
[IconTool]::SaveRounded($fav, 64, 0.22, "$OutDir\favicon-64x64.png")

"generados en $OutDir"
$img.Dispose()
