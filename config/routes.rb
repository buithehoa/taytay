Rails.application.routes.draw do
  namespace :auth do
    get 'spotify/callback'
  end
  get 'auth/index'
  # For details on the DSL available within this file, see https://guides.rubyonrails.org/routing.html
end
