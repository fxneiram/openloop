import { createUniqueId, type ComponentProps } from "solid-js"

export function WordmarkV2(props: Pick<ComponentProps<"svg">, "class">) {
  const mask = createUniqueId()
  const maskGradient = createUniqueId()

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 720 129"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <g opacity="0.6">
        <g mask={`url(#${mask})`}>
          <g opacity="0.16">
            <path
              opacity="0.7"
              d="M82.3846 36.4286H45.4615V91.7143H82.3846V36.4286ZM100.846 110.143H27V18H100.846V110.143Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M137.462 91.7143H174.385V36.4286H137.462V91.7143ZM192.846 110.143H137.462V128.571H119V18H192.846V110.143Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M285.846 73.2857H230.462V91.7143H285.846V110.143H212V18H285.846V73.2857ZM230.462 54.8571H267.385V36.4286H230.462V54.8571Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M359.385 36.4286H322.462V110.143H304V18H359.385V36.4286ZM377.846 110.143H359.385V36.4286H377.846V110.143Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M415.846 18H396V110H415.846V18Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M490.385 36.4286H453.462V91.7143H490.385V36.4286ZM508.846 110.143H435V18H508.846V110.143Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M582.385 36.8571H545.462V92.1429H582.385V36.8571ZM600.846 110.571H527V18.4286H600.846V110.571Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M637.462 91.7143H674.385V36.4286H637.462V91.7143ZM692.846 110.143H637.462V128.571H619V18H692.846V110.143Z"
              fill="currentColor"
            />
          </g>
        </g>
      </g>
      <defs>
        <mask id={mask} style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="720" height="129">
          <rect width="720" height="129" fill={`url(#${maskGradient})`} />
        </mask>
        <linearGradient id={maskGradient} x1="360" y1="68" x2="360" y2="129" gradientUnits="userSpaceOnUse">
          <stop stop-color="white" stop-opacity="0.7" />
          <stop offset="1" stop-color="white" stop-opacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}
