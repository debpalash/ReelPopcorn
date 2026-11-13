import { mount } from "nsh";
import { Window } from "nsh/desktop";
import { Catalog } from "./src/tmdb/Catalog";

function App() {
  Window.setTitle("ReelPopcorn");
  Window.setTitleBar({ style: "hidden", height: 32 });
  return <Catalog />;
}
mount(App);
