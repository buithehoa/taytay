# frozen_string_literal: true

Rails.application.routes.draw do
  root to: 'auth#index'

  get 'auth/index'

  namespace :auth do
    get 'spotify/callback'
  end
  # For details on the DSL available within this file, see https://guides.rubyonrails.org/routing.html
end
