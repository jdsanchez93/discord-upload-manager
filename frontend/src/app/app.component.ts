import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-container">
      <nav class="navbar">
        <div class="nav-brand">
          <h1>Discord Upload Manager</h1>
        </div>
        @if (auth.isAuthenticated$ | async) {
          <div class="nav-links">
            <a routerLink="/files" routerLinkActive="active">Files</a>
            <a routerLink="/upload" routerLinkActive="active">Upload</a>
            <a routerLink="/webhooks" routerLinkActive="active">Webhooks</a>
          </div>
        }
        <div class="nav-auth">
          @if (auth.isAuthenticated$ | async) {
            <span class="user-email">{{ (auth.user$ | async)?.email }}</span>
            <button class="secondary" (click)="logout()">Logout</button>
          } @else {
            <button class="primary" (click)="login()">Login</button>
          }
        </div>
      </nav>
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
    `,
  styles: [`
    .app-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .navbar {
      background-color: var(--surface-color);
      border-bottom: 1px solid var(--border-color);
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }

    .nav-brand h1 {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .nav-links {
      display: flex;
      gap: 24px;
      flex: 1;
      justify-content: center;

      a {
        color: var(--text-secondary);
        text-decoration: none;
        font-weight: 500;
        padding: 8px 16px;
        border-radius: 4px;
        transition: all 0.2s;

        &:hover {
          color: var(--text-primary);
          background-color: var(--surface-hover);
        }

        &.active {
          color: var(--primary-color);
          background-color: rgba(88, 101, 242, 0.1);
        }
      }
    }

    .nav-auth {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .user-email {
      color: var(--text-secondary);
      font-size: 14px;
    }

    .main-content {
      flex: 1;
      padding: 24px;
    }
  `]
})
export class AppComponent {
  auth = inject(AuthService);

  login() {
    this.auth.loginWithRedirect();
  }

  logout() {
    this.auth.logout({ logoutParams: { returnTo: window.location.origin } });
  }
}
