import imperialIranFlagUrl from "../../assets/imperial-iran-flag.svg";

export const ImperialIranFlag = (props) => (
	<img
		src={imperialIranFlagUrl}
		alt="Iran"
		style={{
			width: "16px",
			height: "12px",
			objectFit: "cover",
			display: "inline-block",
			...props.style,
		}}
		{...props}
	/>
);
