import './globals.css'

export const metadata = {
  title: 'GP Importaciones',
  description: 'Administración de stock y ventas de celulares y accesorios',
  icons: [
    {
      rel: 'icon',
      url: '/icon.ico',
    },
  ],
}

/**
 * Componente raíz de la aplicación. Se ha simplificado para delegar la
 * estructura de navegación al `DashboardLayout` en cada página. Esto evita
 * duplicar menús en la parte superior y permite que cada sección se
 * responsabilice de su propia navegación.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" data-theme="light">
      {/*
        DaisyUI aplica la temática a través del atributo `data-theme` en el
        elemento html. Aquí establecemos el tema por defecto a "light". El
        `className` del cuerpo añade las clases de DaisyUI para el fondo y
        color de texto, además de garantizar que ocupe todo el alto de la
        pantalla.
      */}
      <body className="bg-base-200 text-base-content min-h-screen">
        {children}
      </body>
    </html>
  )
}