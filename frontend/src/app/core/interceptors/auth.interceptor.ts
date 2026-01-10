import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { switchMap, take } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  // Only add auth header to API requests
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  return auth.getAccessTokenSilently().pipe(
    take(1),
    switchMap(token => {
      const authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
      return next(authReq);
    })
  );
};
