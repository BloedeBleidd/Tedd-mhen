import { Link, NavLink, type LinkProps, type NavLinkProps } from 'react-router-dom';
import { workspaceDestination } from '../lib/workspace-path';
import { useApi } from '../lib/api';

export function WorkspaceLink({ to, ...props }: LinkProps) {
  return <Link {...props} to={workspaceDestination(to, useApi().demo)} />;
}
export function WorkspaceNavLink({ to, ...props }: NavLinkProps) {
  return <NavLink {...props} to={workspaceDestination(to, useApi().demo)} />;
}
