import { ToastContainer } from "components/linear/Toast";
import { RouterProvider } from "react-router-dom";
import { router } from "./pages/Router";

function App() {
	return (
		<>
			<ToastContainer />
			<RouterProvider router={router} useTransitions={false} />
		</>
	);
}

export default App;
