import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { MenuItem } from 'primeng/api';
import { MenubarModule } from 'primeng/menubar';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, MenubarModule, ButtonModule],
  template: `
    <div class="app-container">
      @if (auth.isAuthenticated$ | async) {
        <p-menubar [model]="menuItems" styleClass="app-menubar">
          <ng-template #start>
            <span class="app-title">Discord Upload Manager</span>
          </ng-template>
          <ng-template #end>
            <div class="flex align-items-center gap-2">
              <span class="user-email hide-on-mobile">{{ (auth.user$ | async)?.email }}</span>
              <p-button
                label="Logout"
                [outlined]="true"
                severity="secondary"
                size="small"
                (onClick)="logout()"
              />
            </div>
          </ng-template>
        </p-menubar>
      } @else {
        <div class="login-navbar">
          <span class="app-title">Discord Upload Manager</span>
          <p-button
            label="Login"
            (onClick)="login()"
            size="small"
          />
        </div>
      }
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

    .app-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
    }

    .user-email {
      color: var(--text-secondary);
      font-size: 0.875rem;
    }

    .login-navbar {
      background-color: var(--surface-color);
      border-bottom: 1px solid var(--border-color);
      padding: 0.75rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .main-content {
      flex: 1;
      padding: 1.5rem;
    }

    :host ::ng-deep {
      .app-menubar {
        background-color: var(--surface-color);
        border-color: var(--border-color);
        border-radius: 0;
        padding: 0.5rem 1rem;

        .p-menubar-start {
          margin-right: 1rem;
        }

        .p-menubar-button {
          color: var(--text-primary);
        }
      }
    }

    @media (max-width: 768px) {
      .main-content {
        padding: 1rem;
      }

      .app-title {
        font-size: 1rem;
      }
    }
  `]
})
export class AppComponent implements OnInit {
  auth = inject(AuthService);
  private router = inject(Router);

  menuItems: MenuItem[] = [];

  ngOnInit() {
    this.menuItems = [
      {
        label: 'Files',
        icon: 'pi pi-images',
        command: () => this.router.navigate(['/files'])
      },
      {
        label: 'Upload',
        icon: 'pi pi-upload',
        command: () => this.router.navigate(['/upload'])
      },
      {
        label: 'Webhooks',
        icon: 'pi pi-link',
        command: () => this.router.navigate(['/webhooks'])
      }
    ];
  }

  login() {
    this.auth.loginWithRedirect();
  }

  logout() {
    this.auth.logout({ logoutParams: { returnTo: window.location.origin } });
  }
}
