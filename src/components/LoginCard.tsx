"use client"

import { signIn } from "next-auth/react"

export default function LoginCard() {
  return (
    <div className="max-w-sm w-full bg-gray-800/70 backdrop-blur-sm rounded-xl shadow-xl p-6 border border-gray-700/40">
      <div className="text-center mb-6 flex flex-col items-center justify-center gap-2">
        <div className="mx-auto flex items-center justify-center">
          <svg
            width="90"
            height="45"
            viewBox="0 0 60 30"
            className="fill-primary shrink-0"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M52.9051 0.169864C53.5247 0.174083 54.0903 0.524401 54.3719 1.07831L59.8256 11.8074C60.1293 12.4048 60.0462 13.1268 59.6149 13.6391L56.467 17.3776C55.0132 19.1042 52.8737 20.0982 50.6214 20.0935L39.8412 20.0709C38.8558 20.0688 37.9204 20.5064 37.2883 21.2651L34.1525 25.0293C34.1159 25.0732 34.0685 25.107 34.0151 25.1272L21.8445 29.7364C21.5245 29.8576 21.2532 29.4726 21.4736 29.2102L34.3083 13.9316C34.9377 13.1824 35.864 12.7494 36.8404 12.7479L51.1152 12.7261C52.0995 12.7246 53.0324 12.2846 53.6618 11.525L56.2871 8.35633C56.556 8.03167 56.3273 7.53927 55.9066 7.53733L40.4565 7.46611C40.1747 7.46482 40.0227 7.1339 40.2047 6.91797L45.4301 0.717513C45.7479 0.340395 46.2161 0.124323 46.7082 0.127674L52.9051 0.169864Z" />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M33.3287 6.86922C33.0124 7.24555 32.5464 7.46212 32.0559 7.46077L13.5574 7.40976C12.6004 7.40712 11.6889 7.81922 11.0568 8.5403L3.69258 16.9407C3.41008 17.263 3.63725 17.7691 4.06492 17.7703L14.5701 17.7991C14.8644 17.7999 15.144 17.67 15.3338 17.4442L16.3762 16.2039C16.5582 15.9873 16.4048 15.6561 16.1225 15.6561L13.5029 15.6561C13.3899 15.6561 13.3286 15.5235 13.4015 15.4369L15.0543 13.4728C15.4331 13.0226 15.9906 12.7632 16.5777 12.7638L27.8692 12.7767C28.0667 12.777 28.1738 13.0088 28.0464 13.1602L18.5167 24.4932C18.2015 24.8682 17.7375 25.0845 17.2487 25.0845L7.68044 25.0846C7.0561 25.0846 6.48462 24.7328 6.20155 24.1743L0.189758 12.3128C-0.107083 11.7272 -0.0330145 11.021 0.378841 10.5102L4.82242 4.99902C7.35071 1.86327 11.1584 0.0460556 15.1776 0.0570848L38.2877 0.120503C38.5696 0.121277 38.7222 0.452076 38.5405 0.668309L33.3287 6.86922Z"
            />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-white">Importaciones</h1>
        <p className="text-gray-400 mt-1">Acceso al sistema</p>
      </div>

      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        className="w-full py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white transition"
      >
        Ingresar con Google
      </button>

      <p className="mt-5 text-center text-xs text-gray-500">
        Solo usuarios autorizados pueden acceder al panel.
      </p>
    </div>
  )
}