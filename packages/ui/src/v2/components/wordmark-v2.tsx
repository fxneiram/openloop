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
              d="M55.3846 36.4286H18.4615V91.7143H55.3846V36.4286ZM73.8462 110.143H0V18H73.8462V110.143Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M110.462 91.7143H147.385V36.4286H110.462V91.7143ZM165.846 110.143H110.462V128.571H92V18H165.846V110.143Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M258.846 73.2857H203.462V91.7143H258.846V110.143H185V18H258.846V73.2857ZM203.462 54.8571H240.385V36.4286H203.462V54.8571Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M332.385 36.4286H295.462V110.143H277V18H332.385V36.4286ZM350.846 110.143H332.385V36.4286H350.846V110.143Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M388.846 18H369V110H388.846V18Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M463.385 36.4286H426.462V91.7143H463.385V36.4286ZM481.846 110.143H408V18H481.846V110.143Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M555.385 36.8571H518.462V92.1429H555.385V36.8571ZM573.846 110.571H500V18.4286H573.846V110.571Z"
              fill="currentColor"
            />
            <path
              opacity="0.7"
              d="M610.462 91.7143H647.385V36.4286H610.462V91.7143ZM665.846 110.143H610.462V128.571H592V18H665.846V110.143Z"
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
