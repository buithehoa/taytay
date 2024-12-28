class LastfmController < ApplicationController
  def authenticate
    callback_url = url_for controller: 'lastfm', action: 'show'
    redirect_to "http://www.last.fm/api/auth/?api_key=#{lastfm_api_key}&cb=#{callback_url}", allow_other_host: true
  end

  def show
    if params[:token].present?
      lastfm.session = lastfm.auth.get_session(token: params[:token])['key']
      @user_info = lastfm.user.get_info
    elsif lastfm.session.nil?
      redirect_to action: 'authenticate'
    else
      @user_info = lastfm.user.get_info
    end
  end

  private

  def lastfm
    @lastfm ||= Lastfm.new(lastfm_api_key, lastfm_shared_secret)
  end

  def lastfm_api_key
    @lastfm_api_key ||= Rails.application.credentials.dig(:lastfm, :api_key)
  end

  def lastfm_shared_secret
    @lastfm_shared_secret ||= Rails.application.credentials.dig(:lastfm, :shared_secret)
  end
end
