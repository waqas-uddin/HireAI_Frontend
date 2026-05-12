import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

const TalentLayout = ({ user, userRole, onLogout }) => {
  return (
    <div className="talent-layout flex">
      <Sidebar user={user} userRole={userRole} onLogout={onLogout} />
      <main className="talent-main flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default TalentLayout;
