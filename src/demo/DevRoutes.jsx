import { Navigate, Route, Routes } from 'react-router-dom';
import AuthForm from '../components/AuthForm.jsx';
import ConfigMissing from '../components/ConfigMissing.jsx';
import HomeView from '../components/HomeView.jsx';
import HostGameView from '../components/HostGameView.jsx';
import PlayerGameView from '../components/PlayerGameView.jsx';
import { DemoAuthScope } from '../context/DemoAuthScope.jsx';
import { DEMO_HOST_ID, DEMO_PLAYER_IDS } from './fixtures.js';
import DevGallery from './DevGallery.jsx';

export default function DevRoutes() {
  return (
    <Routes>
      <Route index element={<DevGallery />} />
      <Route
        path="pages/config"
        element={
          <DemoAuthScope username={null} userId={null}>
            <ConfigMissing />
          </DemoAuthScope>
        }
      />
      <Route
        path="pages/login"
        element={
          <DemoAuthScope username={null} userId={null}>
            <AuthForm />
          </DemoAuthScope>
        }
      />
      <Route
        path="pages/home"
        element={
          <DemoAuthScope username="demo_scout" userId={DEMO_HOST_ID}>
            <HomeView />
          </DemoAuthScope>
        }
      />
      <Route
        path="pages/host-lobby"
        element={
          <DemoAuthScope username="wildy_host" userId={DEMO_HOST_ID}>
            <HostGameView demoGameId="demo-host-lobby" />
          </DemoAuthScope>
        }
      />
      <Route
        path="pages/host-live"
        element={
          <DemoAuthScope username="wildy_host" userId={DEMO_HOST_ID}>
            <HostGameView demoGameId="demo-host-live" />
          </DemoAuthScope>
        }
      />
      <Route
        path="pages/player-pending"
        element={
          <DemoAuthScope username="edge_lad" userId={DEMO_PLAYER_IDS.pending}>
            <PlayerGameView demoGameId="demo-play-pending" />
          </DemoAuthScope>
        }
      />
      <Route
        path="pages/player-lobby"
        element={
          <DemoAuthScope username="pk_snake" userId={DEMO_PLAYER_IDS.approved}>
            <PlayerGameView demoGameId="demo-play-lobby" />
          </DemoAuthScope>
        }
      />
      <Route
        path="pages/player-live"
        element={
          <DemoAuthScope username="pk_snake" userId={DEMO_PLAYER_IDS.playing}>
            <PlayerGameView demoGameId="demo-play-live" />
          </DemoAuthScope>
        }
      />
      <Route
        path="pages/player-kicked"
        element={
          <DemoAuthScope username="grief_kid" userId={DEMO_PLAYER_IDS.kicked}>
            <PlayerGameView demoGameId="demo-play-kicked" />
          </DemoAuthScope>
        }
      />
      <Route path="*" element={<Navigate to="/dev" replace />} />
    </Routes>
  );
}
